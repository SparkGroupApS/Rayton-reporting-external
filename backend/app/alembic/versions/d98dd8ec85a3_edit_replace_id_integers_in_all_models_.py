"""Edit replace id integers in all models to use UUID instead

Revision ID: d98dd8ec85a3
Revises: 9c0a54914c78
Create Date: 2024-07-19 04:08:04.000976

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.types import Uuid


# revision identifiers, used by Alembic.
revision = 'd98dd8ec85a3'
down_revision = '9c0a54914c78'
branch_labels = None
depends_on = None


def upgrade():
    # MariaDB 10.7+ has native UUID type (SQLAlchemy 2.0+)
    
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check if migration already partially applied
    user_columns = [col['name'] for col in inspector.get_columns('user')]
    item_columns = [col['name'] for col in inspector.get_columns('item')]
    
    # Determine which id columns to use for the relationship
    user_id_col = 'id' if 'id' in user_columns else 'new_id'
    item_owner_id_col = 'owner_id' if 'owner_id' in item_columns else 'new_owner_id'
    
    # Create new UUID columns if they don't exist
    if 'new_id' not in user_columns:
        op.add_column('user', sa.Column('new_id', Uuid(), nullable=True))
    if 'new_id' not in item_columns:
        op.add_column('item', sa.Column('new_id', Uuid(), nullable=True))
    if 'new_owner_id' not in item_columns:
        op.add_column('item', sa.Column('new_owner_id', Uuid(), nullable=True))

    # Populate the new columns with UUIDs using MariaDB's UUID() function
    op.execute('UPDATE `user` SET new_id = UUID() WHERE new_id IS NULL')
    op.execute('UPDATE item SET new_id = UUID() WHERE new_id IS NULL')
    
    # Only update new_owner_id if both old columns still exist
    if 'owner_id' in item_columns and user_id_col == 'id':
        op.execute(f'UPDATE item SET new_owner_id = (SELECT new_id FROM `user` WHERE `user`.{user_id_col} = item.{item_owner_id_col}) WHERE new_owner_id IS NULL')

    # Set the new_id as not nullable
    op.alter_column('user', 'new_id', nullable=False, existing_type=Uuid())
    op.alter_column('item', 'new_id', nullable=False, existing_type=Uuid())

    # Get the actual foreign key constraint name
    fks = inspector.get_foreign_keys('item')
    
    # Drop old foreign key constraint(s) that reference owner_id
    for fk in fks:
        if 'owner_id' in fk['constrained_columns']:
            op.drop_constraint(fk['name'], 'item', type_='foreignkey')
    
    # Remove auto_increment from old id columns before dropping primary keys (if id column still exists)
    if 'id' in user_columns:
        op.execute('ALTER TABLE `user` MODIFY COLUMN id INT NOT NULL')
    if 'id' in item_columns:
        op.execute('ALTER TABLE item MODIFY COLUMN id INT NOT NULL')
    
    # Drop old primary keys
    try:
        op.drop_constraint('PRIMARY', 'user', type_='primary')
    except:
        pass  # Primary key might already be dropped
    
    try:
        op.drop_constraint('PRIMARY', 'item', type_='primary')
    except:
        pass  # Primary key might already be dropped
    
    # 1. First drop all old columns
    if 'owner_id' in item_columns:
        op.drop_column('item', 'owner_id')
    if 'id' in user_columns:
        op.drop_column('user', 'id')
    if 'id' in item_columns:
        op.drop_column('item', 'id')
    
    # 2. Then rename the new columns
    op.alter_column('item', 'new_owner_id', new_column_name='owner_id',
                    existing_type=Uuid(),
                    type_=Uuid(),
                    nullable=True)
    op.alter_column('user', 'new_id', new_column_name='id',
                    existing_type=Uuid(),
                    type_=Uuid(),
                    nullable=False)
    op.alter_column('item', 'new_id', new_column_name='id',
                    existing_type=Uuid(),
                    type_=Uuid(),
                    nullable=False)

    # 3. Add primary keys and foreign key constraints
    op.execute('ALTER TABLE `user` ADD PRIMARY KEY (id)')
    op.execute('ALTER TABLE item ADD PRIMARY KEY (id)')
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', ['owner_id'], ['id'])



def downgrade():
    # Reverse the upgrade process
    op.add_column('user', sa.Column('old_id', sa.Integer, autoincrement=True, nullable=True))
    op.add_column('item', sa.Column('old_id', sa.Integer, autoincrement=True, nullable=True))
    op.add_column('item', sa.Column('old_owner_id', sa.Integer, nullable=True))

    # Populate the old columns with incremental integer values
    op.execute('SET @user_counter = 0')
    op.execute('UPDATE `user` SET old_id = (@user_counter := @user_counter + 1)')
    
    op.execute('SET @item_counter = 0')
    op.execute('UPDATE item SET old_id = (@item_counter := @item_counter + 1)')
    
    # Update foreign key relationships
    op.execute('UPDATE item SET old_owner_id = (SELECT old_id FROM `user` WHERE `user`.id = item.owner_id)')

    # Get the actual foreign key constraint name
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fks = inspector.get_foreign_keys('item')
    
    # Drop foreign key constraint(s) that reference owner_id
    for fk in fks:
        if 'owner_id' in fk['constrained_columns']:
            op.drop_constraint(fk['name'], 'item', type_='foreignkey')
    
    # Remove auto_increment from old id columns before dropping primary keys
    op.execute('ALTER TABLE `user` MODIFY COLUMN id INT NOT NULL')
    op.execute('ALTER TABLE item MODIFY COLUMN id INT NOT NULL')
    
    # Drop primary keys
    op.drop_constraint('PRIMARY', 'user', type_='primary')
    op.drop_constraint('PRIMARY', 'item', type_='primary')
    
    # Drop UUID columns
    op.drop_column('item', 'owner_id')
    op.drop_column('user', 'id')
    op.drop_column('item', 'id')
    
    # Rename old columns back - Fix the column renames with proper type specifications
    
    #op.alter_column('item', 'old_owner_id', new_column_name='owner_id')
    #op.alter_column('user', 'old_id', new_column_name='id')
    #op.alter_column('item', 'old_id', new_column_name='id')
    op.alter_column('item', 'old_owner_id', new_column_name='owner_id',
                    existing_type=sa.Integer(),
                    type_=sa.Integer(),
                    nullable=True)
    op.alter_column('user', 'old_id', new_column_name='id',
                    existing_type=sa.Integer(),
                    type_=sa.Integer(),
                    nullable=False,
                    autoincrement=True)
    op.alter_column('item', 'old_id', new_column_name='id',
                    existing_type=sa.Integer(),
                    type_=sa.Integer(),
                    nullable=False,
                    autoincrement=True)

    # Replace the primary key creation lines in downgrade():
    # Instead of:
    # op.create_primary_key('PRIMARY', 'user', ['id'])
    # op.create_primary_key('PRIMARY', 'item', ['id'])
    
    # Use direct ALTER TABLE commands:
    op.execute('ALTER TABLE `user` ADD PRIMARY KEY (id)')
    op.execute('ALTER TABLE item ADD PRIMARY KEY (id)')

    # Recreate foreign key constraint
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', ['owner_id'], ['id'])