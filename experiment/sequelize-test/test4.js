const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'test4.db'),
  logging: console.log,
});

// Define model with camelCase attributes but snake_case database columns using field mappings
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
    field: 'org_uid',  // Map camelCase API to snake_case DB
  },
  orgHash: {
    type: DataTypes.STRING,
    field: 'org_hash',
  },
  name: DataTypes.STRING,
  icon: DataTypes.STRING,
  registryId: {
    type: DataTypes.STRING,
    field: 'registry_id',
  },
  registryHash: {
    type: DataTypes.STRING,
    field: 'registry_hash',
  },
  fileStoreId: {
    type: DataTypes.STRING,
    field: 'file_store_id',
  },
  fileStoreSubscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'file_store_subscribed',
  },
  subscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isHome: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_home',
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
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at',
  },
  dataModelVersionStoreId: {
    type: DataTypes.STRING,
    field: 'data_model_version_store_id',
  },
  dataModelVersionStoreHash: {
    type: DataTypes.STRING,
    field: 'data_model_version_store_hash',
  },
  v2RegistryId: {
    type: DataTypes.STRING,
    field: 'v2_registry_id',
  },
  v2RegistryHash: {
    type: DataTypes.STRING,
    field: 'v2_registry_hash',
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

async function testCamelCaseApiSnakeCaseDb() {
  try {
    console.log('=== CamelCase API + Snake Case DB Test ===\n');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced\n');

    // Test 1: Create an organization using camelCase API
    console.log('Test 1: Creating organization with camelCase API...');
    const org = await Organization.create({
      orgUid: 'org-001',           // camelCase API
      name: 'Test Org',
      icon: 'test-icon',
      isHome: true,                // camelCase API
      subscribed: true,
    });
    console.log('Created organization:', org.toJSON());
    console.log('');

    // Test 2: Find home organization using camelCase API
    console.log('Test 2: Finding home organization with camelCase API...');
    const homeOrg = await Organization.findOne({
      where: { isHome: true },    // camelCase API
      raw: true,
    });
    console.log('Found home organization:', homeOrg);
    console.log('');

    // Test 3: Find by orgUid using camelCase API
    console.log('Test 3: Finding by orgUid with camelCase API...');
    const foundOrg = await Organization.findOne({
      where: { orgUid: 'org-001' }, // camelCase API
      raw: true,
    });
    console.log('Found organization:', foundOrg);
    console.log('');

    // Test 4: Check database schema
    console.log('Test 4: Database schema...');
    const [results] = await sequelize.query("PRAGMA table_info(organizations)");
    console.log('Database columns:', results.map(r => r.name));
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testCamelCaseApiSnakeCaseDb();

