"""Fix comment updated_at: remove default, make nullable

Revision ID: cm002
Revises: al002
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'cm002'
down_revision = 'al002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make updated_at nullable (remove server default)
    op.alter_column('comments', 'updated_at',
                    existing_type=sa.DateTime(),
                    nullable=True,
                    server_default=None)

    # Reset updated_at to NULL for comments that were never actually edited
    # (created_at and updated_at differ by less than 1 second)
    op.execute("""
        UPDATE comments
        SET updated_at = NULL
        WHERE updated_at IS NOT NULL
          AND ABS(EXTRACT(EPOCH FROM (updated_at - created_at))) < 1
    """)


def downgrade() -> None:
    # Restore updated_at to non-nullable with default
    op.execute("""
        UPDATE comments
        SET updated_at = created_at
        WHERE updated_at IS NULL
    """)
    op.alter_column('comments', 'updated_at',
                    existing_type=sa.DateTime(),
                    nullable=False,
                    server_default=sa.text('now()'))
