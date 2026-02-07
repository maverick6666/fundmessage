from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.schemas.common import APIResponse
from app.models.decision_note import DecisionNote
from app.models.position import Position
from app.dependencies import get_current_user, get_manager
from app.models.user import User

router = APIRouter()


class DecisionNoteCreate(BaseModel):
    title: str
    content: str
    blocks: Optional[List[Any]] = None


class DecisionNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    blocks: Optional[List[Any]] = None


def note_to_dict(note: DecisionNote) -> dict:
    return {
        "id": note.id,
        "position_id": note.position_id,
        "title": note.title,
        "content": note.content,
        "blocks": note.blocks,
        "author": {
            "id": note.author.id,
            "username": note.author.username,
            "full_name": note.author.full_name
        } if note.author else None,
        "author_id": note.created_by,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        "created_at": note.created_at.isoformat() if note.created_at else None
    }


@router.get("/{position_id}/notes", response_model=APIResponse)
async def get_decision_notes(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션의 의사결정 노트 목록 조회"""
    notes = db.query(DecisionNote).filter(
        DecisionNote.position_id == position_id
    ).order_by(DecisionNote.created_at.desc()).all()

    return APIResponse(
        success=True,
        data={"notes": [note_to_dict(n) for n in notes]}
    )


@router.get("/{position_id}/notes/{note_id}", response_model=APIResponse)
async def get_decision_note(
    position_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """단일 의사결정 노트 조회 (전체 내용 포함)"""
    note = db.query(DecisionNote).filter(
        DecisionNote.id == note_id,
        DecisionNote.position_id == position_id
    ).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    return APIResponse(
        success=True,
        data=note_to_dict(note)
    )


@router.post("/{position_id}/notes", response_model=APIResponse)
async def create_decision_note(
    position_id: int,
    note_data: DecisionNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """의사결정 노트 작성 (팀장만)"""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")

    note = DecisionNote(
        position_id=position_id,
        title=note_data.title,
        content=note_data.content,
        blocks=note_data.blocks,
        created_by=current_user.id
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return APIResponse(
        success=True,
        data=note_to_dict(note),
        message="의사결정 노트가 작성되었습니다"
    )


@router.patch("/{position_id}/notes/{note_id}", response_model=APIResponse)
async def update_decision_note(
    position_id: int,
    note_id: int,
    note_data: DecisionNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """의사결정 노트 수정 (팀장만)"""
    note = db.query(DecisionNote).filter(
        DecisionNote.id == note_id,
        DecisionNote.position_id == position_id
    ).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if note_data.title is not None:
        note.title = note_data.title
    if note_data.content is not None:
        note.content = note_data.content
    if note_data.blocks is not None:
        note.blocks = note_data.blocks

    db.commit()
    db.refresh(note)

    return APIResponse(
        success=True,
        data=note_to_dict(note),
        message="의사결정 노트가 수정되었습니다"
    )


@router.delete("/{position_id}/notes/{note_id}", response_model=APIResponse)
async def delete_decision_note(
    position_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """의사결정 노트 삭제 (팀장만)"""
    note = db.query(DecisionNote).filter(
        DecisionNote.id == note_id,
        DecisionNote.position_id == position_id
    ).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    db.delete(note)
    db.commit()

    return APIResponse(
        success=True,
        message="의사결정 노트가 삭제되었습니다"
    )
