# Family Monitor Architecture

## Overview

Family Monitor is a full-stack application designed to help families manage chores and screentime through a reward-based system. The architecture consists of a React Native frontend, Python FastAPI backend, and Firebase infrastructure.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                         │
│               (iOS/Android via Expo)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Routes: Auth, Chores, Users, Monitoring          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Services: Business Logic & Firebase Integration       │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │ Firebase Admin SDK
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Firebase Services                          │
│  ┌──────────────┬──────────────┬──────────────────────┐    │
│  │ Auth         │ Realtime DB  │ Firestore            │    │
│  │ (User Mgmt)  │ (Real-time)  │ (Document Storage)   │    │
│  └──────────────┴──────────────┴──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Collections/Paths

#### Users
```
/users/{userId}
├── email: string
├── name: string
├── role: 'parent' | 'child'
├── dateOfBirth: timestamp (for children)
├── screenTimeAllowance: number (minutes)
├── screenTimeUsed: number (minutes)
├── totalPoints: number
└── createdAt: timestamp
```

#### Chores
```
/chores/{choreId}
├── title: string
├── description: string
├── assignedTo: userId
├── assignedBy: userId (parent)
├── status: 'pending' | 'in-progress' | 'completed'
├── points: number
├── dueDate: timestamp
├── createdAt: timestamp
└── completedAt: timestamp
```

#### Activity Logs
```
/activity_logs/{logId}
├── userId: string
├── type: 'app_usage' | 'content_view' | 'action'
├── appName: string (optional)
├── duration: number (minutes)
├── isAppropriate: boolean
├── timestamp: timestamp
└── metadata: object
```

#### Blocked Content
```
/blocked_content/{blockId}
├── userId: string (child)
├── contentType: string
├── contentId: string
├── reason: string
├── blockedAt: timestamp
├── blockedBy: userId (parent)
└── expiresAt: timestamp (optional)
```

## API Flow

### Authentication Flow
1. User registers via `/api/auth/register`
2. Backend creates Firebase Auth user
3. Backend stores user profile in Firestore
4. Returns JWT token for subsequent requests
5. Token includes userId and role

### Chore Completion Flow
1. Child marks chore as complete
2. Frontend sends POST to `/api/chores/{id}/complete`
3. Backend verifies chore ownership and status
4. Updates Firestore chore document
5. Awards points to child via Realtime DB
6. Broadcasts update via Firebase Realtime DB
7. Frontend receives real-time update

### Monitoring Flow
1. Parent opens monitoring dashboard
2. Frontend queries `/api/monitoring/{userId}`
3. Backend fetches activity logs from Firestore
4. Subscribes to Realtime DB for live updates
5. Frontend displays activity in real-time
6. Parent can block content via POST request

## Real-time Communication

### Firebase Realtime Database
Used for:
- Live activity monitoring
- Instant point updates
- Real-time user status (online/offline)
- Live notification delivery

### WebSocket (Optional Enhancement)
Future consideration for high-frequency updates like:
- Location tracking
- Device battery status
- Network activity

## Security Considerations

### Authentication
- Firebase Authentication for user management
- JWT tokens for API requests
- Role-based access control (RBAC)

### Authorization
- Parents can only view their children's data
- Children can only view their own data
- Only parents can create/modify content rules

### Data Validation
- Pydantic models for request validation
- Firebase security rules for database access
- Input sanitization for user-generated content

### Privacy
- Sensitive data encrypted at rest
- HTTPS/TLS for transit
- No tracking of exact browsing history
- Aggregate metrics instead of detailed logs

## Scalability

### Frontend
- React Native handles iOS/Android
- Expo simplifies development and deployment
- Local caching for offline support

### Backend
- FastAPI auto-scales with Uvicorn
- Stateless design for horizontal scaling
- Firebase handles database scaling

### Database
- Firestore auto-scales with usage
- Indexes on frequently queried fields
- Archival of old activity logs

## Deployment

### Backend
- Python 3.9+ with FastAPI
- Docker containerization
- Cloud deployment (Google Cloud, AWS, Heroku)

### Frontend
- Expo EAS Build for CI/CD
- Automatic OTA updates
- App Store and Play Store distribution

## Testing Strategy

### Unit Tests
- API endpoint tests
- Service layer tests
- Authentication logic

### Integration Tests
- Firebase integration
- End-to-end API flows
- Real-time database updates

### E2E Tests
- User workflows
- Cross-platform consistency

## Future Enhancements

- Machine learning for content filtering
- Location tracking with geofencing
- Voice/video call monitoring
- Advanced analytics dashboard
- Gamification elements (badges, leaderboards)
- Integration with popular apps for usage tracking
