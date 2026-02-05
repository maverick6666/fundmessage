from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.discussion import Discussion, DiscussionStatus
from app.models.message import Message, MessageType
from app.models.request import Request, RequestStatus
from app.models.position import Position
from app.schemas.discussion import DiscussionCreate, DiscussionClose, MessageCreate


class DiscussionService:
    def __init__(self, db: Session):
        self.db = db

    def get_discussion_by_id(self, discussion_id: int) -> Optional[Discussion]:
        return self.db.query(Discussion).filter(Discussion.id == discussion_id).first()

    def get_discussion_by_request_id(self, request_id: int) -> Optional[Discussion]:
        return self.db.query(Discussion).filter(Discussion.request_id == request_id).first()

    def get_discussion_by_position_id(self, position_id: int) -> Optional[Discussion]:
        return self.db.query(Discussion).filter(Discussion.position_id == position_id).first()

    def get_discussions_by_position_id(self, position_id: int) -> List[Discussion]:
        return self.db.query(Discussion).filter(Discussion.position_id == position_id).order_by(Discussion.opened_at.desc()).all()

    def create_discussion(self, discussion_data: DiscussionCreate, opened_by: int) -> Discussion:
        # Either request_id or position_id must be provided
        if not discussion_data.request_id and not discussion_data.position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either request_id or position_id must be provided"
            )

        request = None
        position = None

        if discussion_data.request_id:
            # Check if request exists
            request = self.db.query(Request).filter(Request.id == discussion_data.request_id).first()
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Request not found"
                )
            # Update request status to discussion
            request.status = RequestStatus.DISCUSSION.value

        if discussion_data.position_id:
            # Check if position exists
            position = self.db.query(Position).filter(Position.id == discussion_data.position_id).first()
            if not position:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Position not found"
                )

        discussion = Discussion(
            request_id=discussion_data.request_id,
            position_id=discussion_data.position_id,
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

    def reopen_discussion(self, discussion_id: int, reopened_by: int) -> Discussion:
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        if discussion.status == DiscussionStatus.OPEN.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discussion is already open"
            )

        discussion.status = DiscussionStatus.OPEN.value
        discussion.closed_by = None
        discussion.closed_at = None

        # Request status를 다시 discussion으로
        if discussion.request:
            discussion.request.status = RequestStatus.DISCUSSION.value

        # Add system message
        system_message = Message(
            discussion_id=discussion.id,
            user_id=reopened_by,
            content="Discussion reopened",
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

    def get_discussion_sessions(self, discussion_id: int) -> list[dict]:
        """Parse system messages to identify open/close session boundaries."""
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        messages, _ = self.get_messages(discussion_id, page=1, limit=10000)

        sessions = []
        current_session_start = None
        current_session_msgs = 0

        for msg in messages:
            if msg.message_type == MessageType.SYSTEM.value:
                if msg.content in ("Discussion started", "Discussion reopened"):
                    current_session_start = msg.created_at
                    current_session_msgs = 0
                elif msg.content == "Discussion closed" and current_session_start:
                    sessions.append({
                        "session_number": len(sessions) + 1,
                        "started_at": current_session_start.isoformat(),
                        "closed_at": msg.created_at.isoformat(),
                        "message_count": current_session_msgs,
                        "status": "closed"
                    })
                    current_session_start = None
                    current_session_msgs = 0
            elif msg.message_type == MessageType.TEXT.value and current_session_start:
                current_session_msgs += 1

        # If there's an open session remaining
        if current_session_start:
            sessions.append({
                "session_number": len(sessions) + 1,
                "started_at": current_session_start.isoformat(),
                "closed_at": None,
                "message_count": current_session_msgs,
                "status": "open"
            })

        # If no sessions found (old data without system messages), treat entire discussion as one session
        if not sessions:
            text_count = sum(1 for m in messages if m.message_type == MessageType.TEXT.value)
            sessions.append({
                "session_number": 1,
                "started_at": discussion.opened_at.isoformat() if discussion.opened_at else None,
                "closed_at": discussion.closed_at.isoformat() if discussion.closed_at else None,
                "message_count": text_count,
                "status": discussion.status
            })

        return sessions

    def export_discussion_txt(self, discussion_id: int, session_numbers: list[int] = None) -> list[dict]:
        """Export discussion sessions as text content."""
        discussion = self.get_discussion_by_id(discussion_id)
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )

        messages, _ = self.get_messages(discussion_id, page=1, limit=10000)

        # Parse sessions with their messages
        sessions = []
        current_session = None

        for msg in messages:
            if msg.message_type == MessageType.SYSTEM.value:
                if msg.content in ("Discussion started", "Discussion reopened"):
                    current_session = {
                        "number": len(sessions) + 1,
                        "started_at": msg.created_at,
                        "closed_at": None,
                        "messages": [],
                        "participants": set()
                    }
                elif msg.content == "Discussion closed" and current_session:
                    current_session["closed_at"] = msg.created_at
                    sessions.append(current_session)
                    current_session = None
            elif msg.message_type == MessageType.TEXT.value and current_session:
                current_session["messages"].append(msg)
                current_session["participants"].add(msg.user.full_name or msg.user.username)

        # Handle open session
        if current_session:
            sessions.append(current_session)

        # Fallback: no system messages
        if not sessions:
            text_msgs = [m for m in messages if m.message_type == MessageType.TEXT.value]
            participants = set()
            for m in text_msgs:
                participants.add(m.user.full_name or m.user.username)
            sessions.append({
                "number": 1,
                "started_at": discussion.opened_at,
                "closed_at": discussion.closed_at,
                "messages": text_msgs,
                "participants": participants
            })

        # Filter to requested sessions
        if session_numbers:
            sessions = [s for s in sessions if s["number"] in session_numbers]

        # Format each session as text
        results = []
        for sess in sessions:
            lines = []
            lines.append(f"토론: {discussion.title}")
            start_str = sess["started_at"].strftime("%Y-%m-%d %H:%M") if sess["started_at"] else "?"
            end_str = sess["closed_at"].strftime("%Y-%m-%d %H:%M") if sess["closed_at"] else "진행중"
            lines.append(f"세션 {sess['number']}: {start_str} ~ {end_str}")
            lines.append(f"참여자: {', '.join(sorted(sess['participants']))}")
            lines.append("")
            lines.append("---")
            lines.append("")

            for msg in sess["messages"]:
                ts = msg.created_at.strftime("%Y-%m-%d %H:%M") if msg.created_at else ""
                name = msg.user.full_name or msg.user.username
                lines.append(f"[{ts}] {name}: {msg.content}")

            results.append({
                "session_number": sess["number"],
                "filename": f"{discussion.title}_세션{sess['number']}.txt",
                "content": "\n".join(lines)
            })

        return results

    def get_message_count(self, discussion_id: int) -> int:
        return self.db.query(Message).filter(Message.discussion_id == discussion_id).count()
