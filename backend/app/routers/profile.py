from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models import User
from app.schemas import UserOut
from app.utils.serializers import user_to_out

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/me", response_model=UserOut)
async def my_profile(user: User = Depends(get_current_user)):
    return user_to_out(user)
