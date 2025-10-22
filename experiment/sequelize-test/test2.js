const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create Sequelize instance (similar to V2)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'test2.db'),
  logging: console.log,
});

// Define model exactly like V2 organizations (snake_case attributes)
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  org_uid: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  org_hash: {
    type: DataTypes.STRING,
  },
  name: DataTypes.STRING,
  icon: DataTypes.STRING,
  registry_id: {
    type: DataTypes.STRING,
  },
  registry_hash: {
    type: DataTypes.STRING,
  },
  file_store_id: {
    type: DataTypes.STRING,
  },
  file_store_subscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  subscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_home: {
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
  created_at: {
    type: DataTypes.DATE,
  },
  updated_at: {
    type: DataTypes.DATE,
  },
  data_model_version_store_id: {
    type: DataTypes.STRING,
  },
  data_model_version_store_hash: {
    type: DataTypes.STRING,
  },
  v2_registry_id: {
    type: DataTypes.STRING,
  },
  v2_registry_hash: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

async function testV2LikeModel() {
  try {
    console.log('=== V2 Organizations Model Test ===\n');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced\n');

    // Test 1: Create an organization (like V2 createHomeOrganization)
    console.log('Test 1: Creating organization...');
    const org = await Organization.create({
      org_uid: 'org-001',
      name: 'Test Org',
      icon: 'test-icon',
      is_home: true,
      subscribed: true,
    });
    console.log('Created organization:', org.toJSON());
    console.log('');

    // Test 2: Find home organization (like V2 getHomeOrg)
    console.log('Test 2: Finding home organization...');
    const homeOrg = await Organization.findOne({
      where: { is_home: true },
      raw: true,
    });
    console.log('Found home organization:', homeOrg);
    console.log('');

    // Test 3: Find by org_uid
    console.log('Test 3: Finding by org_uid...');
    const foundOrg = await Organization.findOne({
      where: { org_uid: 'org-001' },
      raw: true,
    });
    console.log('Found organization:', foundOrg);
    console.log('');

    // Test 4: Update organization
    console.log('Test 4: Updating organization...');
    await Organization.update(
      { name: 'Updated Org' },
      { where: { org_uid: 'org-001' } }
    );
    console.log('Organization updated\n');

    // Test 5: Find updated organization
    console.log('Test 5: Finding updated organization...');
    const updatedOrg = await Organization.findOne({
      where: { org_uid: 'org-001' },
      raw: true,
    });
    console.log('Updated organization:', updatedOrg);
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testV2LikeModel();

