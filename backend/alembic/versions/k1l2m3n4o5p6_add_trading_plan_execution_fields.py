"""Add trading plan execution fields

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-02-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k1l2m3n4o5p6'
down_revision: str = 'j0k1l2m3n4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 이력 유형: plan_saved (계획 저장) | execution (체결 기록)
    op.add_column('trading_plans', sa.Column('record_type', sa.String(20), nullable=True, server_default='plan_saved'))

    # 체결 기록 필드들
    op.add_column('trading_plans', sa.Column('plan_type', sa.String(20), nullable=True))
    op.add_column('trading_plans', sa.Column('execution_index', sa.Integer(), nullable=True))
    op.add_column('trading_plans', sa.Column('target_price', sa.Numeric(20, 8), nullable=True))
    op.add_column('trading_plans', sa.Column('target_quantity', sa.Numeric(20, 8), nullable=True))
    op.add_column('trading_plans', sa.Column('executed_price', sa.Numeric(20, 8), nullable=True))
    op.add_column('trading_plans', sa.Column('executed_quantity', sa.Numeric(20, 8), nullable=True))
    op.add_column('trading_plans', sa.Column('executed_amount', sa.Numeric(20, 2), nullable=True))
    op.add_column('trading_plans', sa.Column('profit_loss', sa.Numeric(20, 2), nullable=True))
    op.add_column('trading_plans', sa.Column('profit_rate', sa.Numeric(10, 6), nullable=True))


def downgrade() -> None:
    op.drop_column('trading_plans', 'profit_rate')
    op.drop_column('trading_plans', 'profit_loss')
    op.drop_column('trading_plans', 'executed_amount')
    op.drop_column('trading_plans', 'executed_quantity')
    op.drop_column('trading_plans', 'executed_price')
    op.drop_column('trading_plans', 'target_quantity')
    op.drop_column('trading_plans', 'target_price')
    op.drop_column('trading_plans', 'execution_index')
    op.drop_column('trading_plans', 'plan_type')
    op.drop_column('trading_plans', 'record_type')
