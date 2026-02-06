"""add blocks to decision_notes

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2025-02-07 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = 'h8c9d0e1f2g3'
down_revision = 'g7b8c9d0e1f2'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in the table"""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # decision_notes에 blocks 컬럼 추가 (블록 에디터 지원)
    if not column_exists('decision_notes', 'blocks'):
        op.add_column('decision_notes', sa.Column('blocks', JSON, nullable=True))


def downgrade():
    if column_exists('decision_notes', 'blocks'):
        op.drop_column('decision_notes', 'blocks')
