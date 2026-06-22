from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.models.user import UserProfile, UserUpdate, UserStats
from app.middleware.auth import get_current_user, require_parent
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=UserProfile)
def get_me(current_user: dict = Depends(get_current_user)):
    return user_service.get_user(current_user["sub"])


@router.get("/children", response_model=List[UserProfile])
def get_children(current_user: dict = Depends(require_parent)):
    return user_service.get_children(current_user["sub"])


@router.get("/{user_id}", response_model=UserProfile)
def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    # Users can only access their own profile or their children's profiles
    if uid != user_id:
        if current_user["role"] == "child":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        children = user_service.get_children(uid)
        if not any(c.uid == user_id for c in children):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    try:
        return user_service.get_user(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{user_id}", response_model=UserProfile)
def update_user(user_id: str, body: UserUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["sub"] != user_id and current_user["role"] != "parent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    try:
        return user_service.update_user(user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{user_id}/stats", response_model=UserStats)
def get_stats(user_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    if uid != user_id and current_user["role"] == "child":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    try:
        return user_service.get_stats(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
