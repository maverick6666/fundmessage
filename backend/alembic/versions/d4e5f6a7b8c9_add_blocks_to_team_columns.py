"""add blocks to team_columns

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b9
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add blocks column to team_columns table (JSON for Editor.js data)
    op.add_column('team_columns', sa.Column('blocks', sa.JSON(), nullable=True))
    # Make content nullable (blocks can replace it)
    op.alter_column('team_columns', 'content', existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    op.alter_column('team_columns', 'content', existing_type=sa.Text(), nullable=False)
    op.drop_column('team_columns', 'blocks')
