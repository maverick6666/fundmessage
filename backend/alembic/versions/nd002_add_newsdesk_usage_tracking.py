"""Add generation_count and last_generated_at to newsdesk

Revision ID: nd002
Revises: nd001
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'nd002'
down_revision = 'nd001'
branch_labels = None
depends_on = None


def upgrade():
    # Add usage tracking columns to news_desks table
    op.add_column('news_desks', sa.Column('generation_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('news_desks', sa.Column('last_generated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('news_desks', 'last_generated_at')
    op.drop_column('news_desks', 'generation_count')
