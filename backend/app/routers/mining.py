from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, MiningLog
from app.schemas import MiningStatusOut, TapRequest
from app.utils.game_settings import get_all_settings

router = APIRouter(prefix="/api/mining", tags=["mining"])

# Internal precision kept at 6 decimals (see models.USDT); display/round to this
# many decimals only when it matters for external-facing math like averaging.
QUANT = Decimal("0.000001")


def _apply_energy_regen(user: User, cfg: dict) -> None:
    """Recompute energy based on elapsed time since last update, and enforce the
    24h full-refill cycle. Mutates user in place."""
    now = datetime.now(timezone.utc)
    last = user.last_energy_update

    cycle_hours = int(cfg.get("energy_cycle_hours", 24))
    cycle_start = user.energy_cycle_started_at
    if cycle_start is None:
        user.energy_cycle_started_at = now
        cycle_start = now
    elif cycle_start.tzinfo is None:
        cycle_start = cycle_start.replace(tzinfo=timezone.utc)

    if (now - cycle_start) >= timedelta(hours=cycle_hours):
        # A full 24h cycle has elapsed since the last reset — refill fully and
        # start a new cycle regardless of how much continuous regen has run.
        user.energy = user.max_energy
        user.energy_cycle_started_at = now
        user.last_energy_update = now
        return

    if last is None:
        user.last_energy_update = now
        return

    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)

    elapsed = (now - last).total_seconds()
    regen_seconds = max(int(cfg["energy_regen_seconds"]), 1)
    regen_amount = int(cfg["energy_regen_amount"])
    max_energy = int(cfg["max_energy"])

    ticks = int(elapsed // regen_seconds)
    if ticks > 0:
        user.energy = min(max_energy, user.energy + ticks * regen_amount)
        user.last_energy_update = last + timedelta(seconds=ticks * regen_seconds)


def _energy_reset_at(user: User, cfg: dict) -> datetime:
    cycle_hours = int(cfg.get("energy_cycle_hours", 24))
    start = user.energy_cycle_started_at or datetime.now(timezone.utc)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start + timedelta(hours=cycle_hours)


def _status_out(user: User, cfg: dict) -> MiningStatusOut:
    return MiningStatusOut(
        balance=float(user.balance),
        energy=user.energy,
        max_energy=user.max_energy,
        reward_per_tap=float(Decimal(cfg["reward_per_tap"])),
        energy_per_tap=int(cfg["energy_per_tap"]),
        energy_regen_amount=int(cfg["energy_regen_amount"]),
        energy_regen_seconds=int(cfg["energy_regen_seconds"]),
        energy_reset_at=_energy_reset_at(user, cfg),
    )


@router.get("/status", response_model=MiningStatusOut)
async def status_(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cfg = await get_all_settings(db)
    _apply_energy_regen(user, cfg)
    await db.commit()
    return _status_out(user, cfg)


@router.post("/tap", response_model=MiningStatusOut)
async def tap(
    payload: TapRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await get_all_settings(db)
    _apply_energy_regen(user, cfg)

    max_taps_per_request = int(cfg["max_taps_per_request"])
    max_taps_per_second = int(cfg["max_taps_per_second"])
    energy_per_tap = int(cfg["energy_per_tap"])
    reward_per_tap = Decimal(cfg["reward_per_tap"])  # 0.01 USDT by default

    # --- Anti-cheat: cap taps per single request ---
    taps = min(payload.taps, max_taps_per_request)

    # --- Anti-cheat: sliding 1-second window rate limit ---
    now = datetime.now(timezone.utc)

    if user.window_started_at and user.window_started_at.tzinfo is None:
        user.window_started_at = user.window_started_at.replace(tzinfo=timezone.utc)

    if user.window_started_at is None or (now - user.window_started_at).total_seconds() >= 1:
        user.window_started_at = now
        user.taps_in_window = 0

    allowed_this_window = max(max_taps_per_second - user.taps_in_window, 0)
    if allowed_this_window <= 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Tapping too fast")

    taps = min(taps, allowed_this_window)
    user.taps_in_window += taps
    user.last_tap_at = now

    # --- Energy check: cannot tap below zero ---
    max_affordable_taps = user.energy // energy_per_tap if energy_per_tap > 0 else taps
    taps = min(taps, max_affordable_taps)

    if taps <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough energy")

    # 1 Tap = 0.01 USDT (or whatever admins configure reward_per_tap to). Decimal
    # arithmetic throughout avoids float rounding drift on the user's balance.
    usdt_earned = (Decimal(taps) * reward_per_tap).quantize(QUANT, rounding=ROUND_DOWN)
    user.energy -= taps * energy_per_tap
    user.balance = (Decimal(user.balance) + usdt_earned).quantize(QUANT, rounding=ROUND_DOWN)

    db.add(MiningLog(user_id=user.id, taps=taps, usdt_earned=usdt_earned))
    await db.commit()

    return _status_out(user, cfg)
