const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'test3.db'),
  logging: console.log,
});

// Define model with camelCase attributes (like V2 was originally doing)
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orgUid: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  orgHash: {
    type: DataTypes.STRING,
  },
  name: DataTypes.STRING,
  icon: DataTypes.STRING,
  registryId: {
    type: DataTypes.STRING,
  },
  registryHash: {
    type: DataTypes.STRING,
  },
  fileStoreId: {
    type: DataTypes.STRING,
  },
  fileStoreSubscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  subscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isHome: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  metadata: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '{}',
  },
  synced: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sync_remaining: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
  },
  updatedAt: {
    type: DataTypes.DATE,
  },
  dataModelVersionStoreId: {
    type: DataTypes.STRING,
  },
  dataModelVersionStoreHash: {
    type: DataTypes.STRING,
  },
  v2RegistryId: {
    type: DataTypes.STRING,
  },
  v2RegistryHash: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

async function testCamelCaseModel() {
  try {
    console.log('=== CamelCase Model Test ===\n');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced\n');

    // Test 1: Create an organization
    console.log('Test 1: Creating organization...');
    const org = await Organization.create({
      orgUid: 'org-001',
      name: 'Test Org',
      icon: 'test-icon',
      isHome: true,
      subscribed: true,
    });
    console.log('Created organization:', org.toJSON());
    console.log('');

    // Test 2: Find home organization
    console.log('Test 2: Finding home organization...');
    const homeOrg = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });
    console.log('Found home organization:', homeOrg);
    console.log('');

    // Test 3: Find by orgUid
    console.log('Test 3: Finding by orgUid...');
    const foundOrg = await Organization.findOne({
      where: { orgUid: 'org-001' },
      raw: true,
    });
    console.log('Found organization:', foundOrg);
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testCamelCaseModel();

