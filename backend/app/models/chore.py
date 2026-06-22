from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class ChoreStatus(str, Enum):
    pending = "pending"
    in_progress = "in-progress"
    completed = "completed"


class ChoreCreate(BaseModel):
    title: str
    description: str = ""
    points: int = 10
    assigned_to: str
    due_date: Optional[datetime] = None


class ChoreUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    status: Optional[ChoreStatus] = None
    due_date: Optional[datetime] = None


class ChoreResponse(BaseModel):
    id: str
    title: str
    description: str
    points: int
    assigned_to: str
    assigned_by: str
    status: ChoreStatus
    due_date: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class ActivityLog(BaseModel):
    user_id: str
    type: str
    app_name: Optional[str] = None
    duration: int = 0
    is_appropriate: bool = True
    metadata: dict = {}


class ActivityLogResponse(ActivityLog):
    id: str
    timestamp: datetime


class BlockedContent(BaseModel):
    content_type: str
    content_id: str
    reason: str = ""


class BlockedContentResponse(BlockedContent):
    id: str
    user_id: str
    blocked_by: str
    blocked_at: datetime
    expires_at: Optional[datetime] = None
