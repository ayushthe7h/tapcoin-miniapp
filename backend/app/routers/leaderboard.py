from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import LeaderboardEntry

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
async def leaderboard(
    type: str = Query("balance", pattern="^(balance|referrals)$"),
    limit: int = Query(100, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    column = User.balance if type == "balance" else User.total_referrals
    rows = (
        await db.execute(
            select(User.username, User.first_name, column)
            .where(User.is_banned == False)  # noqa: E712
            .order_by(desc(column))
            .limit(limit)
        )
    ).all()
    return [
        LeaderboardEntry(rank=i + 1, username=r[0], first_name=r[1], value=float(r[2]))
        for i, r in enumerate(rows)
    ]
