"""Add changes column to trading_plans

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h8c9d0e1f2g3'
down_revision: str = 'g7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trading_plans', sa.Column('changes', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('trading_plans', 'changes')
