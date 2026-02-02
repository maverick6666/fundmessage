from fastapi import WebSocket, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.websocket.connection_manager import ConnectionManager
from app.services.discussion_service import DiscussionService
from app.schemas.discussion import MessageCreate


async def handle_websocket_message(
    websocket: WebSocket,
    data: dict,
    user_id: int,
    manager: ConnectionManager,
    db: Session
):
    message_type = data.get("type")
    payload = data.get("data", {})

    if message_type == "join_discussion":
        discussion_id = payload.get("discussion_id")
        if discussion_id:
            manager.join_discussion(discussion_id, user_id)
            await manager.broadcast_to_discussion(
                discussion_id,
                {
                    "type": "user_joined",
                    "data": {
                        "discussion_id": discussion_id,
                        "user_id": user_id
                    }
                },
                exclude_user=user_id
            )

    elif message_type == "leave_discussion":
        discussion_id = payload.get("discussion_id")
        if discussion_id:
            manager.leave_discussion(discussion_id, user_id)
            await manager.broadcast_to_discussion(
                discussion_id,
                {
                    "type": "user_left",
                    "data": {
                        "discussion_id": discussion_id,
                        "user_id": user_id
                    }
                }
            )

    elif message_type == "send_message":
        discussion_id = payload.get("discussion_id")
        content = payload.get("content")

        if discussion_id and content:
            discussion_service = DiscussionService(db)
            message = discussion_service.create_message(
                discussion_id,
                MessageCreate(content=content),
                user_id
            )

            # Broadcast to others (exclude sender)
            await manager.broadcast_to_discussion(
                discussion_id,
                {
                    "type": "message_received",
                    "data": {
                        "id": message.id,
                        "discussion_id": message.discussion_id,
                        "user": {
                            "id": message.user.id,
                            "username": message.user.username,
                            "full_name": message.user.full_name
                        },
                        "content": message.content,
                        "created_at": message.created_at.isoformat() if message.created_at else None
                    }
                },
                exclude_user=user_id
            )

            # Send confirmation to sender with message ID
            await manager.send_personal_message(
                {
                    "type": "message_sent",
                    "data": {
                        "id": message.id,
                        "discussion_id": message.discussion_id,
                        "user": {
                            "id": message.user.id,
                            "username": message.user.username,
                            "full_name": message.user.full_name
                        },
                        "content": message.content,
                        "created_at": message.created_at.isoformat() if message.created_at else None
                    }
                },
                user_id
            )

    elif message_type == "subscribe_price":
        ticker = payload.get("ticker")
        if ticker:
            manager.subscribe_price(ticker, user_id)

    elif message_type == "unsubscribe_price":
        ticker = payload.get("ticker")
        if ticker:
            manager.unsubscribe_price(ticker, user_id)
