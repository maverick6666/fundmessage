"""make user FKs nullable for account deletion

Revision ID: a1b2c3d4e5f6
Revises: 7a3bc1d42e5f
Create Date: 2026-02-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str = '7a3bc1d42e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('requests', 'requester_id',
                     existing_type=sa.Integer(),
                     nullable=True)
    op.alter_column('discussions', 'opened_by',
                     existing_type=sa.Integer(),
                     nullable=True)
    op.alter_column('messages', 'user_id',
                     existing_type=sa.Integer(),
                     nullable=True)


def downgrade() -> None:
    op.alter_column('messages', 'user_id',
                     existing_type=sa.Integer(),
                     nullable=False)
    op.alter_column('discussions', 'opened_by',
                     existing_type=sa.Integer(),
                     nullable=False)
    op.alter_column('requests', 'requester_id',
                     existing_type=sa.Integer(),
                     nullable=False)
