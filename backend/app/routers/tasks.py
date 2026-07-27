from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Task, CompletedTask, User
from app.schemas import TaskOut

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
async def list_tasks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tasks = (await db.execute(select(Task).where(Task.is_active == True))).scalars().all()  # noqa: E712
    completed_ids = set(
        (await db.execute(select(CompletedTask.task_id).where(CompletedTask.user_id == user.id)))
        .scalars()
        .all()
    )
    return [
        TaskOut(
            id=t.id, title=t.title, description=t.description, reward=t.reward,
            button_text=t.button_text, link=t.link, icon=t.icon, task_type=t.task_type,
            completed=t.id in completed_ids,
        )
        for t in tasks
    ]


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = (await db.execute(select(Task).where(Task.id == task_id, Task.is_active == True))).scalar_one_or_none()  # noqa: E712
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    already = (
        await db.execute(
            select(CompletedTask).where(CompletedTask.user_id == user.id, CompletedTask.task_id == task_id)
        )
    ).scalar_one_or_none()
    if already:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Task already completed")

    try:
        db.add(CompletedTask(user_id=user.id, task_id=task_id))
        user.balance = Decimal(user.balance) + Decimal(task.reward)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Task already completed")

    return TaskOut(
        id=task.id, title=task.title, description=task.description, reward=task.reward,
        button_text=task.button_text, link=task.link, icon=task.icon, task_type=task.task_type,
        completed=True,
    )
