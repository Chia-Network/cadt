const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'test.db'),
  logging: console.log, // Enable SQL logging
});

// Define model with snake_case attributes (like V2 data tables)
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

async function testSequelize() {
  try {
    console.log('=== Sequelize Snake Case Test ===\n');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced\n');

    // Test 1: Create a user
    console.log('Test 1: Creating user...');
    const user = await User.create({
      user_id: 'user-001',
      user_name: 'John Doe',
      user_email: 'john@example.com',
      is_active: true,
    });
    console.log('Created user:', user.toJSON());
    console.log('');

    // Test 2: Find user by snake_case attribute
    console.log('Test 2: Finding user by snake_case attribute...');
    const foundUser = await User.findOne({
      where: { user_id: 'user-001' },
      raw: true,
    });
    console.log('Found user:', foundUser);
    console.log('');

    // Test 3: Find user by another snake_case attribute
    console.log('Test 3: Finding user by is_active...');
    const activeUsers = await User.findAll({
      where: { is_active: true },
      raw: true,
    });
    console.log('Active users:', activeUsers);
    console.log('');

    // Test 4: Update user
    console.log('Test 4: Updating user...');
    await User.update(
      { user_name: 'Jane Doe' },
      { where: { user_id: 'user-001' } }
    );
    console.log('User updated\n');

    // Test 5: Find updated user
    console.log('Test 5: Finding updated user...');
    const updatedUser = await User.findOne({
      where: { user_id: 'user-001' },
      raw: true,
    });
    console.log('Updated user:', updatedUser);
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testSequelize();

