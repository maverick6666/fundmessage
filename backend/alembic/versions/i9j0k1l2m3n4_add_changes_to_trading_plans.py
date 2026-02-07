"""Add changes column to trading_plans

Revision ID: i9j0k1l2m3n4
Revises: h8c9d0e1f2g3
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i9j0k1l2m3n4'
down_revision: str = 'h8c9d0e1f2g3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trading_plans', sa.Column('changes', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('trading_plans', 'changes')
