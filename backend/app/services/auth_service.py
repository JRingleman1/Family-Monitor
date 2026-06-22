from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.config.settings import get_settings
from app.services.firebase_service import get_auth, get_firestore
from app.models.user import UserCreate, UserProfile, Token

settings = get_settings()


def _create_jwt(uid: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": uid, "role": role, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def verify_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise ValueError("Invalid token")


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


def register_user(user_data: UserCreate) -> Token:
    auth = get_auth()
    db = get_firestore()

    decoded = auth.verify_id_token(user_data.firebase_id_token)
    uid = decoded["uid"]

    profile_doc = {
        "uid": uid,
        "email": decoded.get("email", ""),
        "name": user_data.name,
        "role": user_data.role.value,
        "parentId": user_data.parent_id,
        "totalPoints": 0,
        "screenTimeAllowance": user_data.screen_time_allowance,
        "screenTimeUsed": 0,
        "createdAt": datetime.utcnow().isoformat(),
    }
    db.collection("users").document(uid).set(profile_doc)

    profile = _doc_to_profile(profile_doc)
    return Token(access_token=_create_jwt(uid, user_data.role.value), user=profile)


def login_user(firebase_id_token: str) -> Token:
    auth = get_auth()
    db = get_firestore()

    decoded = auth.verify_id_token(firebase_id_token)
    uid = decoded["uid"]

    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise ValueError("User profile not found — please register first.")

    data = doc.to_dict()
    profile = _doc_to_profile(data)
    return Token(access_token=_create_jwt(uid, data["role"]), user=profile)
