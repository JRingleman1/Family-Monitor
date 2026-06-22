# Family Monitor

A comprehensive family monitoring and chore management app that gamifies household responsibilities. Kids earn screentime and app access by completing chores and demonstrating responsible behavior, while parents maintain real-time monitoring and content filtering.

## Features

- **Chore Management**: Create, assign, and track family chores with rewards
- **Screentime Earning System**: Kids earn device time by completing tasks and responsible actions
- **Parental Controls**: Real-time monitoring of device activity and app usage
- **Content Filtering**: Protect kids from inappropriate content
- **Real-time Updates**: Firebase Realtime Database for instant synchronization
- **Multi-user Support**: Parent and child accounts with role-based access

## Tech Stack

### Frontend
- **React Native** - Cross-platform mobile app (iOS/Android)
- **Firebase SDK** - Real-time data sync and authentication

### Backend
- **Python** - FastAPI/Flask for REST API
- **Firebase Admin SDK** - Server-side database and auth management
- **Firestore** - Document database for users, chores, and activity logs

### Infrastructure
- **Firebase Realtime Database** - Real-time synchronization
- **Firebase Authentication** - User management
- **Firebase Cloud Storage** - Media files (optional)

## Project Structure

```
family-monitor/
├── frontend/                 # React Native app
│   ├── src/
│   │   ├── screens/         # App screens (Parent, Child, Chores, etc.)
│   │   ├── components/      # Reusable components
│   │   ├── services/        # Firebase services
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # Global state management
│   │   └── navigation/      # Navigation configuration
│   ├── app.json             # Expo config
│   └── package.json
│
├── backend/                 # FastAPI/Flask backend
│   ├── app/
│   │   ├── main.py          # App entry point
│   │   ├── api/             # API routes
│   │   │   ├── auth.py
│   │   │   ├── chores.py
│   │   │   ├── users.py
│   │   │   └── monitoring.py
│   │   ├── models/          # Data models
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, error handling
│   │   └── config/          # Configuration
│   ├── requirements.txt
│   └── .env.example
│
├── docs/                    # Documentation
├── .env.example             # Environment variables template
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js & npm (for React Native)
- Python 3.9+ (for backend)
- Firebase project setup
- Expo CLI (for React Native development)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configure Firebase credentials in .env
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
# Configure Firebase config in src/config/firebase.js
npx expo start
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Chores
- `GET /api/chores` - Get all chores
- `POST /api/chores` - Create new chore
- `PUT /api/chores/{id}` - Update chore
- `POST /api/chores/{id}/complete` - Mark chore as complete

### Users
- `GET /api/users/{id}` - Get user profile
- `PUT /api/users/{id}` - Update user profile
- `GET /api/users/{id}/stats` - Get user statistics

### Monitoring
- `GET /api/monitoring/{user_id}` - Get activity logs
- `POST /api/monitoring/{user_id}/block` - Block app/content

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

Private Project - Family Use Only

## Support

For issues or feature requests, open an issue in the repository.
