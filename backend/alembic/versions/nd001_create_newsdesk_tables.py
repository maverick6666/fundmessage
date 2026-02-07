"""Create newsdesk tables

Revision ID: nd001
Revises: k1l2m3n4o5p6
Create Date: 2026-02-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'nd001'
down_revision: str = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'news_desks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('publish_date', sa.Date(), nullable=False, unique=True, index=True),
        sa.Column('columns', sa.JSON(), nullable=True),
        sa.Column('news_cards', sa.JSON(), nullable=True),
        sa.Column('keywords', sa.JSON(), nullable=True),
        sa.Column('sentiment', sa.JSON(), nullable=True),
        sa.Column('top_stocks', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('raw_news_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        'raw_news',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('link', sa.String(1000), nullable=True),
        sa.Column('pub_date', sa.DateTime(), nullable=True),
        sa.Column('collected_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('keywords', sa.JSON(), nullable=True),
        sa.Column('sentiment', sa.String(20), nullable=True),
        sa.Column('newsdesk_date', sa.Date(), index=True),
    )


def downgrade() -> None:
    op.drop_table('raw_news')
    op.drop_table('news_desks')
