"""Add push_subscriptions table

Revision ID: ps001
Revises: as002
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'ps001'
down_revision = 'as002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'push_subscriptions' not in inspector.get_table_names():
        op.create_table(
            'push_subscriptions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('endpoint', sa.Text(), nullable=False),
            sa.Column('p256dh', sa.String(200), nullable=False),
            sa.Column('auth', sa.String(100), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('endpoint', name='uq_push_subscription_endpoint'),
        )
        op.create_index('ix_push_subscriptions_id', 'push_subscriptions', ['id'])


def downgrade() -> None:
    op.drop_table('push_subscriptions')
