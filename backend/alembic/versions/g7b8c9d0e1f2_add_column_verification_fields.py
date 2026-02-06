"""add column verification fields

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2025-02-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in the table"""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in columns


def constraint_exists(table_name, constraint_name):
    """Check if a foreign key constraint exists"""
    bind = op.get_bind()
    insp = inspect(bind)
    fks = [fk['name'] for fk in insp.get_foreign_keys(table_name)]
    return constraint_name in fks


def upgrade():
    # team_columns에 검증 관련 필드 추가
    if not column_exists('team_columns', 'is_verified'):
        op.add_column('team_columns', sa.Column('is_verified', sa.Boolean(), nullable=True, default=False))
    if not column_exists('team_columns', 'verified_by'):
        op.add_column('team_columns', sa.Column('verified_by', sa.Integer(), nullable=True))
    if not column_exists('team_columns', 'verified_at'):
        op.add_column('team_columns', sa.Column('verified_at', sa.DateTime(), nullable=True))
    if not constraint_exists('team_columns', 'fk_team_columns_verified_by'):
        op.create_foreign_key('fk_team_columns_verified_by', 'team_columns', 'users', ['verified_by'], ['id'])

    # attendances에 칼럼으로 복구된 경우를 위한 필드 추가
    if not column_exists('attendances', 'recovered_by_column_id'):
        op.add_column('attendances', sa.Column('recovered_by_column_id', sa.Integer(), nullable=True))
    if not constraint_exists('attendances', 'fk_attendances_recovery_column'):
        op.create_foreign_key('fk_attendances_recovery_column', 'attendances', 'team_columns', ['recovered_by_column_id'], ['id'])


def downgrade():
    if constraint_exists('attendances', 'fk_attendances_recovery_column'):
        op.drop_constraint('fk_attendances_recovery_column', 'attendances', type_='foreignkey')
    if column_exists('attendances', 'recovered_by_column_id'):
        op.drop_column('attendances', 'recovered_by_column_id')

    if constraint_exists('team_columns', 'fk_team_columns_verified_by'):
        op.drop_constraint('fk_team_columns_verified_by', 'team_columns', type_='foreignkey')
    if column_exists('team_columns', 'verified_at'):
        op.drop_column('team_columns', 'verified_at')
    if column_exists('team_columns', 'verified_by'):
        op.drop_column('team_columns', 'verified_by')
    if column_exists('team_columns', 'is_verified'):
        op.drop_column('team_columns', 'is_verified')
