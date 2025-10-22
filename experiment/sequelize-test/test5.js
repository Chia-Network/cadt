const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create Sequelize instance exactly like V2
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'test5.db'),
  logging: console.log,
  timezone: '+00:00',
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
  },
});

// Define model exactly like V2 organizations
const TestOrg = sequelize.define('TestOrg', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orgUid: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'org_uid',
  },
  isHome: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_home',
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

async function testFieldMappings() {
  try {
    console.log('=== Field Mappings Test ===\n');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced\n');

    // Test 1: Create an organization
    console.log('Test 1: Creating organization...');
    const org = await TestOrg.create({
      orgUid: 'test-001',
      isHome: true,
    });
    console.log('Created organization:', org.toJSON());
    console.log('');

    // Test 2: Find home organization
    console.log('Test 2: Finding home organization...');
    const homeOrg = await TestOrg.findOne({
      where: { isHome: true },
      raw: true,
    });
    console.log('Found home organization:', homeOrg);
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testFieldMappings();

