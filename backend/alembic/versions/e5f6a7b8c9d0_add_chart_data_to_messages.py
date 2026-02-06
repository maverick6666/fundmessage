"""add chart_data to messages

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add chart_data column to messages table (JSON for candle data)
    op.add_column('messages', sa.Column('chart_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'chart_data')
