from pydantic import BaseModel
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    parent = "parent"
    child = "child"


class UserCreate(BaseModel):
    firebase_id_token: str
    name: str
    role: UserRole
    parent_id: Optional[str] = None
    screen_time_allowance: int = 60


class UserLogin(BaseModel):
    firebase_id_token: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    screen_time_allowance: Optional[int] = None


class UserProfile(BaseModel):
    uid: str
    email: str
    name: str
    role: UserRole
    parent_id: Optional[str] = None
    total_points: int = 0
    screen_time_allowance: int = 60
    screen_time_used: int = 0


class UserStats(BaseModel):
    total_points: int
    screen_time_allowance: int
    screen_time_used: int
    screen_time_remaining: int
    chores_completed: int
    chores_pending: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
