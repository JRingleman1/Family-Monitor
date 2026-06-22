from typing import List, Optional
from app.services.firebase_service import get_firestore
from app.models.user import UserProfile, UserUpdate, UserStats


def _doc_to_profile(data: dict) -> UserProfile:
    return UserProfile(
        uid=data["uid"],
        email=data.get("email", ""),
        name=data["name"],
        role=data["role"],
        parent_id=data.get("parentId"),
        total_points=data.get("totalPoints", 0),
        screen_time_allowance=data.get("screenTimeAllowance", 60),
        screen_time_used=data.get("screenTimeUsed", 0),
    )


def get_user(uid: str) -> UserProfile:
    db = get_firestore()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise ValueError("User not found")
    return _doc_to_profile(doc.to_dict())


def update_user(uid: str, updates: UserUpdate) -> UserProfile:
    db = get_firestore()
    ref = db.collection("users").document(uid)
    patch = {}
    if updates.name is not None:
        patch["name"] = updates.name
    if updates.screen_time_allowance is not None:
        patch["screenTimeAllowance"] = updates.screen_time_allowance
    ref.update(patch)
    return get_user(uid)


def get_children(parent_uid: str) -> List[UserProfile]:
    db = get_firestore()
    docs = (
        db.collection("users")
        .where("parentId", "==", parent_uid)
        .where("role", "==", "child")
        .stream()
    )
    return [_doc_to_profile(d.to_dict()) for d in docs]


def get_stats(uid: str) -> UserStats:
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise ValueError("User not found")
    user = user_doc.to_dict()

    chores = db.collection("chores").where("assignedTo", "==", uid).stream()
    completed = 0
    pending = 0
    for c in chores:
        if c.to_dict().get("status") == "completed":
            completed += 1
        else:
            pending += 1

    allowance = user.get("screenTimeAllowance", 60)
    used = user.get("screenTimeUsed", 0)
    return UserStats(
        total_points=user.get("totalPoints", 0),
        screen_time_allowance=allowance,
        screen_time_used=used,
        screen_time_remaining=max(0, allowance - used),
        chores_completed=completed,
        chores_pending=pending,
    )
