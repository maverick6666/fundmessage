"""Add realized_pnl, unrealized_pnl, position_details to asset_snapshots

Revision ID: as002
Revises: cm002
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = 'as002'
down_revision = 'cm002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('asset_snapshots',
                  sa.Column('realized_pnl', sa.Numeric(20, 2), server_default='0'))
    op.add_column('asset_snapshots',
                  sa.Column('unrealized_pnl', sa.Numeric(20, 2), server_default='0'))
    op.add_column('asset_snapshots',
                  sa.Column('position_details', JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('asset_snapshots', 'position_details')
    op.drop_column('asset_snapshots', 'unrealized_pnl')
    op.drop_column('asset_snapshots', 'realized_pnl')
