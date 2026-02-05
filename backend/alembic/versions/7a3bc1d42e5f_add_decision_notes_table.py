"""Add decision notes table

Revision ID: 7a3bc1d42e5f
Revises: 5e82a3f91bc4
Create Date: 2026-02-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a3bc1d42e5f'
down_revision: Union[str, None] = '5e82a3f91bc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('decision_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('position_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['position_id'], ['positions.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_decision_notes_id'), 'decision_notes', ['id'], unique=False)
    op.create_index(op.f('ix_decision_notes_position_id'), 'decision_notes', ['position_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_notes_position_id'), table_name='decision_notes')
    op.drop_index(op.f('ix_decision_notes_id'), table_name='decision_notes')
    op.drop_table('decision_notes')
