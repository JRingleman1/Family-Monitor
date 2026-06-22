from datetime import datetime
from typing import List, Optional
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from app.services.firebase_service import get_firestore, get_realtime_db
from app.models.chore import ChoreCreate, ChoreUpdate, ChoreResponse, ChoreStatus


def _doc_to_chore(doc_id: str, data: dict) -> ChoreResponse:
    return ChoreResponse(
        id=doc_id,
        title=data["title"],
        description=data.get("description", ""),
        points=data.get("points", 10),
        assigned_to=data["assignedTo"],
        assigned_by=data["assignedBy"],
        status=data.get("status", "pending"),
        due_date=data.get("dueDate"),
        created_at=data.get("createdAt", datetime.utcnow()),
        completed_at=data.get("completedAt"),
    )


def get_chores_for_parent(parent_uid: str) -> List[ChoreResponse]:
    db = get_firestore()
    docs = db.collection("chores").where("assignedBy", "==", parent_uid).stream()
    return [_doc_to_chore(d.id, d.to_dict()) for d in docs]


def get_chores_for_child(child_uid: str) -> List[ChoreResponse]:
    db = get_firestore()
    docs = db.collection("chores").where("assignedTo", "==", child_uid).stream()
    return [_doc_to_chore(d.id, d.to_dict()) for d in docs]


def create_chore(parent_uid: str, chore_data: ChoreCreate) -> ChoreResponse:
    db = get_firestore()
    doc = {
        "title": chore_data.title,
        "description": chore_data.description,
        "points": chore_data.points,
        "assignedTo": chore_data.assigned_to,
        "assignedBy": parent_uid,
        "status": ChoreStatus.pending.value,
        "dueDate": chore_data.due_date.isoformat() if chore_data.due_date else None,
        "createdAt": datetime.utcnow().isoformat(),
        "completedAt": None,
    }
    ref = db.collection("chores").add(doc)[1]
    return _doc_to_chore(ref.id, doc)


def update_chore(chore_id: str, parent_uid: str, updates: ChoreUpdate) -> ChoreResponse:
    db = get_firestore()
    ref = db.collection("chores").document(chore_id)
    doc = ref.get()
    if not doc.exists:
        raise ValueError("Chore not found")
    data = doc.to_dict()
    if data["assignedBy"] != parent_uid:
        raise PermissionError("Cannot modify another parent's chore")

    patch = {k: v for k, v in {
        "title": updates.title,
        "description": updates.description,
        "points": updates.points,
        "status": updates.status.value if updates.status else None,
        "dueDate": updates.due_date.isoformat() if updates.due_date else None,
    }.items() if v is not None}
    ref.update(patch)
    data.update(patch)
    return _doc_to_chore(chore_id, data)


def complete_chore(chore_id: str, child_uid: str) -> ChoreResponse:
    db = get_firestore()
    rtdb = get_realtime_db()
    ref = db.collection("chores").document(chore_id)
    doc = ref.get()
    if not doc.exists:
        raise ValueError("Chore not found")
    data = doc.to_dict()
    if data["assignedTo"] != child_uid:
        raise PermissionError("This chore is not assigned to you")
    if data["status"] == ChoreStatus.completed.value:
        raise ValueError("Chore already completed")

    completed_at = datetime.utcnow().isoformat()
    ref.update({"status": ChoreStatus.completed.value, "completedAt": completed_at})

    # Award points in Firestore and broadcast via Realtime DB
    user_ref = db.collection("users").document(child_uid)
    user_doc = user_ref.get().to_dict()
    new_points = user_doc.get("totalPoints", 0) + data["points"]
    user_ref.update({"totalPoints": new_points})

    # Push live update to Realtime DB so parents see it instantly
    rtdb.reference(f"points/{child_uid}").set({"totalPoints": new_points, "updatedAt": completed_at})

    data.update({"status": ChoreStatus.completed.value, "completedAt": completed_at})
    return _doc_to_chore(chore_id, data)


def delete_chore(chore_id: str, parent_uid: str) -> None:
    db = get_firestore()
    ref = db.collection("chores").document(chore_id)
    doc = ref.get()
    if not doc.exists:
        raise ValueError("Chore not found")
    if doc.to_dict()["assignedBy"] != parent_uid:
        raise PermissionError("Cannot delete another parent's chore")
    ref.delete()
