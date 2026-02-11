"""Change audit_log action column to TEXT

Revision ID: al001
Revises: a304889e1662
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'al001'
down_revision = 'a304889e1662'
branch_labels = None
depends_on = None


def upgrade():
    # Change action column from VARCHAR(50) to TEXT
    op.alter_column('audit_logs', 'action',
                    existing_type=sa.String(50),
                    type_=sa.Text(),
                    existing_nullable=False)


def downgrade():
    # Revert back to VARCHAR(50)
    op.alter_column('audit_logs', 'action',
                    existing_type=sa.Text(),
                    type_=sa.String(50),
                    existing_nullable=False)
