from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.discussion import Discussion, DiscussionStatus
from app.models.message import Message, MessageType
from app.models.request import Request, RequestStatus
from app.schemas.discussion import DiscussionCreate, DiscussionClose, MessageCreate


class DiscussionService:
    def __init__(self, db: Session):
        self.db = db

    def get_discussion_by_id(self, discussion_id: int) -> Optional[Discussion]:
        return self.db.query(Discussion).filter(Discussion.id == discussion_id).first()

    def get_discussion_by_request_id(self, request_id: int) -> Optional[Discussion]:
        return self.db.query(Discussion).filter(Discussion.request_id == request_id).first()

    def create_discussion(self, discussion_data: DiscussionCreate, opened_by: int) -> Discussion:
        # Check if request exists and is in pending status
        request = self.db.query(Request).filter(Request.id == discussion_data.request_id).first()
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found"
            )

        # Update request status to discussion
        request.status = RequestStatus.DISCUSSION.value

        discussion = Discussion(
            request_id=discussion_data.request_id,
            title=discussion_data.title,
            status=DiscussionStatus.OPEN.value,
            opened_by=opened_by,
            opened_at=datetime.utcnow()
        )

        self.db.add(discussion)
        self.db.flush()  # discussion.id를 얻기 위해 flush

        # Add system message
        system_message = Message(
            discussion_id=discussion.id,
            user_id=opened_by,
            content="Discussion started",
            message_type=MessageType.SYSTEM.value
        )
        self.db.add(system_message)

        self.db.commit()
        self.db.refresh(discussion)

        return discussion

    def close_discussion(self, discussion_id: int, close_data: DiscussionClose, closed_by: int) -> Discussion:
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        if discussion.status == DiscussionStatus.CLOSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discussion is already closed"
            )

        discussion.status = DiscussionStatus.CLOSED.value
        discussion.closed_by = closed_by
        discussion.closed_at = datetime.utcnow()
        discussion.summary = close_data.summary

        # Add system message
        system_message = Message(
            discussion_id=discussion.id,
            user_id=closed_by,
            content="Discussion closed",
            message_type=MessageType.SYSTEM.value
        )
        self.db.add(system_message)

        self.db.commit()
        self.db.refresh(discussion)

        return discussion

    def get_messages(
        self,
        discussion_id: int,
        page: int = 1,
        limit: int = 50
    ) -> tuple[List[Message], int]:
        query = self.db.query(Message).filter(Message.discussion_id == discussion_id)

        total = query.count()
        messages = query.order_by(Message.created_at.asc()).offset((page - 1) * limit).limit(limit).all()

        return messages, total

    def create_message(self, discussion_id: int, message_data: MessageCreate, user_id: int) -> Message:
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        if discussion.status == DiscussionStatus.CLOSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add message to closed discussion"
            )

        message = Message(
            discussion_id=discussion_id,
            user_id=user_id,
            content=message_data.content,
            message_type=MessageType.TEXT.value
        )

        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)

        return message

    def get_discussion_export(self, discussion_id: int) -> dict:
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        messages, _ = self.get_messages(discussion_id, page=1, limit=10000)

        # Get unique participants
        participants = {}
        for msg in messages:
            if msg.user_id not in participants:
                participants[msg.user_id] = {
                    "id": msg.user.id,
                    "username": msg.user.username
                }

        return {
            "discussion": {
                "id": discussion.id,
                "title": discussion.title,
                "opened_at": discussion.opened_at.isoformat() if discussion.opened_at else None,
                "closed_at": discussion.closed_at.isoformat() if discussion.closed_at else None
            },
            "participants": list(participants.values()),
            "messages": [
                {
                    "timestamp": msg.created_at.isoformat() if msg.created_at else None,
                    "user": msg.user.username,
                    "content": msg.content
                }
                for msg in messages
            ]
        }

    def get_message_count(self, discussion_id: int) -> int:
        return self.db.query(Message).filter(Message.discussion_id == discussion_id).count()
