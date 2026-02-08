"""Add comments table

Revision ID: cm001
Revises: nd002
Create Date: 2026-02-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'cm001'
down_revision: str = 'nd002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('document_type', sa.String(50), nullable=False, index=True),
        sa.Column('document_id', sa.Integer(), nullable=False, index=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('comments')
