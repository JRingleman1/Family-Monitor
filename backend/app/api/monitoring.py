from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from app.models.chore import ActivityLog, ActivityLogResponse, BlockedContent, BlockedContentResponse
from app.middleware.auth import get_current_user, require_parent
from app.services import monitoring_service, user_service

router = APIRouter()


def _assert_parent_can_access_child(parent_uid: str, child_uid: str):
    children = user_service.get_children(parent_uid)
    if not any(c.uid == child_uid for c in children):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.get("/{child_id}/activity", response_model=List[ActivityLogResponse])
def get_activity(
    child_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_parent),
):
    _assert_parent_can_access_child(current_user["sub"], child_id)
    return monitoring_service.get_activity(child_id, limit)


@router.post("/{child_id}/activity", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
def log_activity(child_id: str, body: ActivityLog, current_user: dict = Depends(get_current_user)):
    # Children log their own activity; parents can log for their children
    if current_user["role"] == "child" and current_user["sub"] != child_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return monitoring_service.log_activity(child_id, body)


@router.post("/{child_id}/block", response_model=BlockedContentResponse, status_code=status.HTTP_201_CREATED)
def block_content(child_id: str, body: BlockedContent, current_user: dict = Depends(require_parent)):
    _assert_parent_can_access_child(current_user["sub"], child_id)
    return monitoring_service.block_content(child_id, current_user["sub"], body)


@router.get("/{child_id}/blocked", response_model=List[BlockedContentResponse])
def get_blocked(child_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    if current_user["role"] == "child" and uid != child_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current_user["role"] == "parent":
        _assert_parent_can_access_child(uid, child_id)
    return monitoring_service.get_blocked_content(child_id)
