# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Family Monitor is a full-stack app that gamifies household chores — kids earn screentime by completing chores; parents monitor activity in real time. It is a **React Native (Expo) + Python FastAPI + Firebase** monorepo with two main directories: `frontend/` and `backend/`.

## Development Commands

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in Firebase credentials
uvicorn app.main:app --reload   # runs on http://localhost:8000
```

- API docs: `http://localhost:8000/docs`
- Run tests: `pytest`
- Lint: `flake8`
- Format: `black .`
- Type-check: `mypy app/`
- Run a single test: `pytest tests/path/to/test_file.py::test_function_name`

### Frontend (Expo / React Native)

```bash
cd frontend
npm install
cp .env.example .env.local      # fill in Firebase + API URL
npm start                       # Expo dev server
npm run ios                     # iOS simulator
npm run android                 # Android emulator
npm test                        # Jest tests
npm run lint                    # ESLint
npm run format                  # Prettier
```

## Architecture

```
React Native App (Expo)
        │ HTTP/REST
        ▼
FastAPI Backend (Python)
        │ Firebase Admin SDK
        ▼
Firebase (Auth + Firestore + Realtime DB)
```

The frontend also communicates **directly** with Firebase for real-time subscriptions (live point updates, activity feeds, online status), while all write operations and business logic go through the FastAPI backend.

### Backend (`backend/app/`)

- `main.py` — FastAPI app setup, CORS middleware, health check. Route modules are stubbed out with TODO comments; the routers in `app/api/` need to be implemented and registered here.
- `api/` — Route handlers for `auth`, `chores`, `users`, `monitoring` (not yet implemented beyond stubs).
- `services/` — Business logic and Firebase Admin SDK calls.
- `models/` — Pydantic data models for request/response validation.
- `middleware/` — Auth (JWT verification) and error handling middleware.
- `config/` — App configuration (Firebase credentials, env vars via `pydantic-settings`).

Authentication uses **Firebase Auth** for user identity plus a **JWT** issued by the backend (HS256, 30 min expiry). The backend verifies the JWT on protected routes via middleware, then enforces role-based access (parent vs. child) at the service layer.

### Frontend (`frontend/src/`)

- `screens/` — Full-page views (Parent dashboard, Child view, Chores, etc.).
- `components/` — Reusable UI components.
- `services/` — Firebase SDK wrappers (auth, Firestore reads, Realtime DB subscriptions).
- `hooks/` — Custom React hooks.
- `context/` — Global state via React Context.
- `navigation/` — React Navigation stack and bottom-tab configuration.
- `config/firebase.js` — Firebase app initialization (must be configured before first run).

State management uses **Zustand** for global client state. Navigation is React Navigation v6.

### Firebase Data Model

| Collection/Path | Key fields |
|---|---|
| `/users/{userId}` | `role: 'parent'|'child'`, `screenTimeAllowance`, `totalPoints` |
| `/chores/{choreId}` | `status: 'pending'|'in-progress'|'completed'`, `assignedTo`, `points` |
| `/activity_logs/{logId}` | `type: 'app_usage'|'content_view'|'action'`, `isAppropriate` |
| `/blocked_content/{blockId}` | `contentType`, `blockedBy` (parent userId), `expiresAt` |

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env.local`. Both need Firebase credentials. The backend also needs `SECRET_KEY`, `JWT_SECRET`, and `GOOGLE_APPLICATION_CREDENTIALS` pointing to the Firebase service account JSON.

Firebase service account key (`firebase-key.json`) must be placed in the `backend/` root and is `.gitignore`d — never commit it.

## Key Constraints

- The API routes (`/api/auth`, `/api/chores`, `/api/users`, `/api/monitoring`) are **defined in the architecture** but the route modules are not yet implemented — the comments in `backend/app/main.py` show what needs to be wired up.
- Parents can only access their own children's data; children can only access their own data. This RBAC must be enforced at the service layer, not just in Firebase rules.
- Realtime Database is used for live state (points, online status, notifications). Firestore stores durable records (user profiles, chores, activity logs). Don't mix them up.
