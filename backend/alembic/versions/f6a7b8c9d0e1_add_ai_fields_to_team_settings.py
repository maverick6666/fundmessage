"""add ai fields to team_settings

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-07 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AI 사용량 관리 컬럼 추가
    op.add_column('team_settings', sa.Column('ai_daily_limit', sa.Integer(), nullable=True, server_default='3'))
    op.add_column('team_settings', sa.Column('ai_usage_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('team_settings', sa.Column('ai_usage_reset_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('team_settings', 'ai_usage_reset_date')
    op.drop_column('team_settings', 'ai_usage_count')
    op.drop_column('team_settings', 'ai_daily_limit')
