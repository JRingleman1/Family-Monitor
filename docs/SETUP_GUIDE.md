# Family Monitor Setup Guide

## Prerequisites

### For Backend
- Python 3.9 or higher
- pip (Python package manager)
- Git

### For Frontend
- Node.js 16+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Or physical device with Expo Go app

### For Both
- Firebase project setup
- Firebase service account JSON key
- Environment variables configured

## Backend Setup

### Step 1: Clone and Navigate
```bash
git clone https://github.com/JRingleman1/Family-Monitor.git
cd Family-Monitor/backend
```

### Step 2: Create Virtual Environment
```bash
python -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Firebase credentials:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
SECRET_KEY=generate_a_secure_random_string
JWT_SECRET=generate_another_secure_random_string
```

### Step 5: Run Development Server
```bash
uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

## Frontend Setup

### Step 1: Navigate to Frontend
```bash
cd Family-Monitor/frontend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase and API credentials:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
API_BASE_URL=http://localhost:8000
```

### Step 4: Start Development Server
```bash
npm start
```

Choose platform:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

## Firebase Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter "Family-Monitor" as project name
4. Complete setup wizard

### Step 2: Enable Services

#### Authentication
1. Go to Authentication → Sign-in method
2. Enable "Email/Password"
3. Enable "Anonymous" (optional)

#### Firestore Database
1. Go to Firestore Database
2. Create database in production mode
3. Set security rules (see SECURITY.md)

#### Realtime Database
1. Go to Realtime Database
2. Create database
3. Start in test mode (for development)

### Step 3: Download Service Account Key
1. Go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save as `firebase-key.json` in backend root
4. Add to `.gitignore`

### Step 4: Update Environment
```bash
# In backend/.env
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-key.json"
```

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Troubleshooting

### Backend Issues

**Port already in use**
```bash
# Find and kill process on port 8000
lsof -i :8000
kill -9 <PID>
```

**Firebase authentication error**
- Verify `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Check service account key has correct permissions

### Frontend Issues

**Expo connection issues**
- Ensure device is on same network as development machine
- Check firewall settings

**Firebase not initializing**
- Verify `.env.local` has correct Firebase credentials
- Clear Expo cache: `expo cache clear`

## Next Steps

1. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for endpoint details
3. Read [SECURITY.md](./SECURITY.md) for security guidelines
4. Start implementing features from [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md)
