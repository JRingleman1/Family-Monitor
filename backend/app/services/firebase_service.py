import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore, db as realtime_db

_initialized = False


def _initialize():
    global _initialized
    if _initialized:
        return

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    db_url = os.getenv("FIREBASE_DATABASE_URL", "")

    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {"databaseURL": db_url})
    _initialized = True


def get_auth():
    _initialize()
    return firebase_auth


def get_firestore():
    _initialize()
    return firestore.client()


def get_realtime_db():
    _initialize()
    return realtime_db
