"""Add trading_plans table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: str = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('trading_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('position_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('buy_plan', sa.JSON(), nullable=True),
        sa.Column('take_profit_targets', sa.JSON(), nullable=True),
        sa.Column('stop_loss_targets', sa.JSON(), nullable=True),
        sa.Column('memo', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['position_id'], ['positions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trading_plans_id'), 'trading_plans', ['id'], unique=False)
    op.create_index(op.f('ix_trading_plans_position_id'), 'trading_plans', ['position_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_trading_plans_position_id'), table_name='trading_plans')
    op.drop_index(op.f('ix_trading_plans_id'), table_name='trading_plans')
    op.drop_table('trading_plans')
