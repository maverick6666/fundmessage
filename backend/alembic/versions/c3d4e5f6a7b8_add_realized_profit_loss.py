"""add realized_profit_loss to positions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add realized_profit_loss column to positions table
    op.add_column('positions', sa.Column('realized_profit_loss', sa.Numeric(20, 2), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('positions', 'realized_profit_loss')
