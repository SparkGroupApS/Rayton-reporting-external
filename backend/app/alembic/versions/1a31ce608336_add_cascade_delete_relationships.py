"""Add cascade delete relationships

Revision ID: 1a31ce608336
Revises: d98dd8ec85a3
Create Date: 2024-07-31 22:24:34.447891

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.types import Uuid


# revision identifiers, used by Alembic.
revision = '1a31ce608336'
down_revision = 'd98dd8ec85a3'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Get existing foreign keys
    fks = inspector.get_foreign_keys('item')
    
    # Drop any existing foreign key constraints on owner_id
    for fk in fks:
        if 'owner_id' in fk['constrained_columns']:
            op.drop_constraint(fk['name'], 'item', type_='foreignkey')
    
    # Then modify the column with explicit type matching the referenced column
    op.alter_column('item', 'owner_id',
                    existing_type=Uuid(),
                    type_=Uuid(),
                    nullable=False)
    
    # Finally create the new foreign key with CASCADE
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', 
                         ['owner_id'], ['id'], 
                         ondelete='CASCADE')
    # ### end Alembic commands ###


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Get existing foreign keys
    fks = inspector.get_foreign_keys('item')
    
    # Drop any existing foreign key constraints on owner_id
    for fk in fks:
        if 'owner_id' in fk['constrained_columns']:
            op.drop_constraint(fk['name'], 'item', type_='foreignkey')
    
    # Modify the column back to nullable with explicit type
    op.alter_column('item', 'owner_id',
                    existing_type=Uuid(),
                    type_=Uuid(),
                    nullable=True)
    
    # Recreate the original foreign key without CASCADE
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', 
                         ['owner_id'], ['id'])
    # ### end Alembic commands ###
