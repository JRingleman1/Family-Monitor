from datetime import datetime
from typing import List, Optional
from app.services.firebase_service import get_firestore
from app.models.chore import ActivityLog, ActivityLogResponse, BlockedContent, BlockedContentResponse


def log_activity(child_uid: str, activity: ActivityLog) -> ActivityLogResponse:
    db = get_firestore()
    now = datetime.utcnow()
    doc = {
        "userId": child_uid,
        "type": activity.type,
        "appName": activity.app_name,
        "duration": activity.duration,
        "isAppropriate": activity.is_appropriate,
        "metadata": activity.metadata,
        "timestamp": now.isoformat(),
    }
    ref = db.collection("activity_logs").add(doc)[1]
    return ActivityLogResponse(
        id=ref.id,
        user_id=child_uid,
        type=activity.type,
        app_name=activity.app_name,
        duration=activity.duration,
        is_appropriate=activity.is_appropriate,
        metadata=activity.metadata,
        timestamp=now,
    )


def get_activity(child_uid: str, limit: int = 50) -> List[ActivityLogResponse]:
    db = get_firestore()
    docs = (
        db.collection("activity_logs")
        .where("userId", "==", child_uid)
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    results = []
    for d in docs:
        data = d.to_dict()
        results.append(ActivityLogResponse(
            id=d.id,
            user_id=data["userId"],
            type=data["type"],
            app_name=data.get("appName"),
            duration=data.get("duration", 0),
            is_appropriate=data.get("isAppropriate", True),
            metadata=data.get("metadata", {}),
            timestamp=datetime.fromisoformat(data["timestamp"]),
        ))
    return results


def block_content(child_uid: str, parent_uid: str, content: BlockedContent) -> BlockedContentResponse:
    db = get_firestore()
    now = datetime.utcnow()
    doc = {
        "userId": child_uid,
        "contentType": content.content_type,
        "contentId": content.content_id,
        "reason": content.reason,
        "blockedBy": parent_uid,
        "blockedAt": now.isoformat(),
        "expiresAt": None,
    }
    ref = db.collection("blocked_content").add(doc)[1]
    return BlockedContentResponse(
        id=ref.id,
        user_id=child_uid,
        content_type=content.content_type,
        content_id=content.content_id,
        reason=content.reason,
        blocked_by=parent_uid,
        blocked_at=now,
    )


def get_blocked_content(child_uid: str) -> List[BlockedContentResponse]:
    db = get_firestore()
    docs = db.collection("blocked_content").where("userId", "==", child_uid).stream()
    results = []
    for d in docs:
        data = d.to_dict()
        results.append(BlockedContentResponse(
            id=d.id,
            user_id=data["userId"],
            content_type=data["contentType"],
            content_id=data["contentId"],
            reason=data.get("reason", ""),
            blocked_by=data["blockedBy"],
            blocked_at=datetime.fromisoformat(data["blockedAt"]),
        ))
    return results
