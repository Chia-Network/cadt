import { DataTypes } from 'sequelize';

export default {
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
};
