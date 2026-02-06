"""add column verification fields

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2025-02-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    # team_columns에 검증 관련 필드 추가
    op.add_column('team_columns', sa.Column('is_verified', sa.Boolean(), nullable=True, default=False))
    op.add_column('team_columns', sa.Column('verified_by', sa.Integer(), nullable=True))
    op.add_column('team_columns', sa.Column('verified_at', sa.DateTime(), nullable=True))
    op.create_foreign_key('fk_team_columns_verified_by', 'team_columns', 'users', ['verified_by'], ['id'])

    # attendances에 칼럼으로 복구된 경우를 위한 필드 추가
    op.add_column('attendances', sa.Column('recovered_by_column_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_attendances_recovery_column', 'attendances', 'team_columns', ['recovered_by_column_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_attendances_recovery_column', 'attendances', type_='foreignkey')
    op.drop_column('attendances', 'recovered_by_column_id')

    op.drop_constraint('fk_team_columns_verified_by', 'team_columns', type_='foreignkey')
    op.drop_column('team_columns', 'verified_at')
    op.drop_column('team_columns', 'verified_by')
    op.drop_column('team_columns', 'is_verified')
