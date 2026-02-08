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
from app.services.scheduler import init_scheduler, shutdown_scheduler

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
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://fundmessage.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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


# Startup event (시드 계정 생성 제거됨 - 첫 가입자가 자동으로 팀장이 됨)
@app.on_event("startup")
async def startup_event():
    init_scheduler()
    print("Fund Team Messenger API started")


@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
    print("Fund Team Messenger API shutdown")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
