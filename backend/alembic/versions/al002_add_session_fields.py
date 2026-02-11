"""Add session management fields to discussion and message

Revision ID: al002
Revises: al001
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'al002'
down_revision = 'al001'
branch_labels = None
depends_on = None


def upgrade():
    # Discussion 테이블에 세션 관리 필드 추가
    op.add_column('discussions', sa.Column('session_count', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('discussions', sa.Column('current_agenda', sa.Text(), nullable=True))

    # Message 테이블에 세션 번호 필드 추가
    op.add_column('messages', sa.Column('session_number', sa.Integer(), nullable=True, server_default='1'))

    # 기존 데이터 업데이트
    op.execute("UPDATE discussions SET session_count = 1 WHERE session_count IS NULL")
    op.execute("UPDATE messages SET session_number = 1 WHERE session_number IS NULL")


def downgrade():
    op.drop_column('messages', 'session_number')
    op.drop_column('discussions', 'current_agenda')
    op.drop_column('discussions', 'session_count')
