"""Add attendance_shields to users and shield_granted to team_columns

Revision ID: as001
Revises: cm001
Create Date: 2026-02-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'as001'
down_revision = 'cm001'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in the table"""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # users 테이블에 attendance_shields 필드 추가
    if not column_exists('users', 'attendance_shields'):
        op.add_column('users', sa.Column(
            'attendance_shields', sa.Integer(),
            nullable=False, server_default='0'
        ))

    # team_columns 테이블에 shield_granted 필드 추가
    if not column_exists('team_columns', 'shield_granted'):
        op.add_column('team_columns', sa.Column(
            'shield_granted', sa.Boolean(),
            nullable=False, server_default='false'
        ))


def downgrade():
    if column_exists('team_columns', 'shield_granted'):
        op.drop_column('team_columns', 'shield_granted')
    if column_exists('users', 'attendance_shields'):
        op.drop_column('users', 'attendance_shields')
