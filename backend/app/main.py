"""Family Monitor Backend - FastAPI Application"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Family Monitor API",
    description="API for family monitoring and chore management app",
    version="1.0.0"
)

# CORS Configuration
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}

# Root Endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Family Monitor API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi_schema": "/openapi.json"
    }

# TODO: Import and include API route modules
# from app.api import auth, chores, users, monitoring
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(chores.router, prefix="/api/chores", tags=["chores"])
# app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
