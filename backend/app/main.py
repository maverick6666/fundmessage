from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from app.config import settings
from app.database import get_db, engine, Base
from app.api import api_router
from app.websocket import manager
from app.websocket.handlers import handle_websocket_message
from app.utils.security import decode_token

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Fund Team Messenger API",
    description="API for managing fund team trading decisions",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    # Verify token
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id = int(payload.get("sub"))

    # Connect
    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Get DB session for this message
            db = next(get_db())
            try:
                await handle_websocket_message(websocket, message, user_id, manager, db)
            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        manager.disconnect(websocket, user_id)


# Startup event - create initial manager user if not exists
@app.on_event("startup")
async def startup_event():
    from app.services.auth_service import AuthService
    from app.schemas.user import UserCreate
    from app.models.user import UserRole

    db = next(get_db())
    try:
        auth_service = AuthService(db)

        # Check if manager exists
        existing_manager = auth_service.get_user_by_email("manager@fund.com")
        if not existing_manager:
            # Create initial manager
            manager_data = UserCreate(
                email="manager@fund.com",
                username="manager",
                password="manager123!",  # Change in production
                full_name="Fund Manager",
                role=UserRole.MANAGER.value
            )
            auth_service.create_user(manager_data)
            print("Initial manager user created: manager@fund.com / manager123!")
    except Exception as e:
        print(f"Startup error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
