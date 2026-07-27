from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_admin
from app.models import (
    User, Task, CompletedTask, Referral, DailyReward, AdminUser,
    Notification, AdminLog,
)
from app.schemas import (
    AdminLoginRequest, AdminTokenOut, TaskCreate, TaskUpdate, TaskOut,
    AdminUserEditRequest, AdminSettingsUpdate, BroadcastRequest,
)
from app.utils.game_settings import get_all_settings, set_setting
from app.utils.security import create_access_token, verify_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _log(db: AsyncSession, admin: AdminUser, action: str):
    db.add(AdminLog(admin_username=admin.username, action=action))
    await db.commit()


@router.post("/login", response_model=AdminTokenOut)
async def admin_login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    admin = (
        await db.execute(select(AdminUser).where(AdminUser.username == payload.username))
    ).scalar_one_or_none()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    token = create_access_token(
        {"sub": str(admin.id), "type": "admin"}, secret=settings.ADMIN_JWT_SECRET
    )
    return AdminTokenOut(access_token=token)


@router.get("/dashboard")
async def dashboard(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    active_users = (
        await db.execute(select(func.count(User.id)).where(User.last_login >= week_ago))
    ).scalar_one()
    today_users = (
        await db.execute(select(func.count(User.id)).where(User.join_date >= today_start))
    ).scalar_one()
    usdt_generated = (await db.execute(select(func.coalesce(func.sum(User.balance), 0)))).scalar_one()
    tasks_completed = (await db.execute(select(func.count(CompletedTask.id)))).scalar_one()
    referral_count = (await db.execute(select(func.count(Referral.id)))).scalar_one()
    daily_claims = (
        await db.execute(select(func.count(DailyReward.id)).where(DailyReward.claimed_at >= today_start))
    ).scalar_one()

    top_users_rows = (
        await db.execute(select(User.username, User.first_name, User.balance).order_by(desc(User.balance)).limit(10))
    ).all()

    return {
        "total_users": total_users,
        "active_users_7d": active_users,
        "today_users": today_users,
        "usdt_generated": float(usdt_generated),
        "tasks_completed": tasks_completed,
        "referral_count": referral_count,
        "daily_claims_today": daily_claims,
        "top_users": [
            {"username": r[0], "first_name": r[1], "balance": float(r[2])} for r in top_users_rows
        ],
    }


# ---------- Users ----------

@router.get("/users")
async def list_users(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, le=100),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            (User.username.ilike(like))
            | (User.first_name.ilike(like))
            | (User.last_name.ilike(like))
        )
    stmt = stmt.order_by(User.id).offset((page - 1) * page_size).limit(page_size)
    users = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": u.id, "telegram_id": u.telegram_id, "username": u.username,
            "first_name": u.first_name, "last_name": u.last_name,
            "balance": float(u.balance), "energy": u.energy, "total_referrals": u.total_referrals,
            "is_banned": u.is_banned, "join_date": u.join_date,
        }
        for u in users
    ]


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_banned = True
    await db.commit()
    await _log(db, admin, f"Banned user {user_id}")
    return {"ok": True}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_banned = False
    await db.commit()
    await _log(db, admin, f"Unbanned user {user_id}")
    return {"ok": True}


@router.post("/users/{user_id}/reset-balance")
async def reset_balance(user_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.balance = 0
    await db.commit()
    await _log(db, admin, f"Reset balance for user {user_id}")
    return {"ok": True}


@router.post("/users/{user_id}/reset-energy")
async def reset_energy(user_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.energy = user.max_energy
    await db.commit()
    await _log(db, admin, f"Reset energy for user {user_id}")
    return {"ok": True}


@router.put("/users/{user_id}")
async def edit_user(
    user_id: int, payload: AdminUserEditRequest,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.balance is not None:
        user.balance = payload.balance
    if payload.energy is not None:
        user.energy = payload.energy
    if payload.total_referrals is not None:
        user.total_referrals = payload.total_referrals
    if payload.is_banned is not None:
        user.is_banned = payload.is_banned
    await db.commit()
    await _log(db, admin, f"Edited user {user_id}: {payload.model_dump(exclude_none=True)}")
    return {"ok": True}


# ---------- Tasks ----------

@router.get("/tasks", response_model=list[TaskOut])
async def admin_list_tasks(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    tasks = (await db.execute(select(Task).order_by(Task.id))).scalars().all()
    return [
        TaskOut(
            id=t.id, title=t.title, description=t.description, reward=t.reward,
            button_text=t.button_text, link=t.link, icon=t.icon, task_type=t.task_type,
            completed=not t.is_active,  # reused field here just to surface active state in admin UI
        )
        for t in tasks
    ]


@router.post("/tasks")
async def create_task(payload: TaskCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    await db.commit()
    await _log(db, admin, f"Created task '{task.title}'")
    return {"ok": True, "id": task.id}


@router.put("/tasks/{task_id}")
async def update_task(task_id: int, payload: TaskUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    await db.commit()
    await _log(db, admin, f"Updated task {task_id}")
    return {"ok": True}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    await db.delete(task)
    await db.commit()
    await _log(db, admin, f"Deleted task {task_id}")
    return {"ok": True}


# ---------- Settings ----------

@router.get("/settings")
async def get_settings_(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    return await get_all_settings(db)


@router.put("/settings")
async def update_settings(payload: AdminSettingsUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    for key, value in payload.settings.items():
        await set_setting(db, key, value)
    await _log(db, admin, f"Updated settings: {list(payload.settings.keys())}")
    return {"ok": True}


# ---------- Broadcast ----------

@router.post("/broadcast")
async def broadcast(payload: BroadcastRequest, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    from app.services.telegram_notify import send_broadcast  # local import avoids bot-token requirement at startup

    if payload.target == "single" and not payload.target_telegram_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "target_telegram_id required for single target")

    if payload.target == "single":
        targets = [payload.target_telegram_id]
    else:
        targets = [
            r[0] for r in (await db.execute(select(User.telegram_id).where(User.is_banned == False))).all()  # noqa: E712
        ]

    sent, failed = await send_broadcast(targets, payload.title, payload.message)

    notif = Notification(
        title=payload.title, message=payload.message, target=payload.target,
        target_telegram_id=payload.target_telegram_id, sent_count=sent, failed_count=failed,
    )
    db.add(notif)
    await db.commit()
    await _log(db, admin, f"Broadcast '{payload.title}' to {len(targets)} users ({sent} sent, {failed} failed)")
    return {"sent": sent, "failed": failed}


# ---------- Logs ----------

@router.get("/logs")
async def view_logs(
    limit: int = Query(100, le=500),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(AdminLog).order_by(desc(AdminLog.created_at)).limit(limit))).scalars().all()
    return [
        {"id": r.id, "admin": r.admin_username, "action": r.action, "created_at": r.created_at}
        for r in rows
    ]
