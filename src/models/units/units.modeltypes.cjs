const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  warehouseUnitId: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  /* Issuance Primary Key */
  issuanceId: {
    type: Sequelize.STRING,
    required: true,
  },
  /* Project Location Primary Key */
  projectLocationId: {
    type: Sequelize.STRING,
    required: true,
  },
  // The orgUid is teh singeltonId of the
  // organizations tables on the datalayer
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  unitOwner: {
    type: Sequelize.STRING,
    required: true,
  },
  countryJurisdictionOfOwner: {
    type: Sequelize.STRING,
    required: true,
  },
  inCountryJurisdictionOfOwner: {
    type: Sequelize.STRING,
    required: true,
  },
  serialNumberBlock: {
    type: Sequelize.STRING,
    required: true,
  },
  serialNumberPattern: {
    type: Sequelize.STRING,
    defaultValue: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
  },
  vintageYear: {
    type: Sequelize.STRING,
    required: true,
  },
  unitType: {
    type: Sequelize.STRING,
    required: true,
  },
  marketplace: {
    type: Sequelize.STRING,
  },
  marketplaceLink: {
    type: Sequelize.STRING,
  },
  marketplaceIdentifier: {
    type: Sequelize.STRING,
  },
  unitTags: {
    type: Sequelize.STRING,
  },
  unitStatus: {
    type: Sequelize.STRING,
    required: true,
  },
  unitStatusReason: {
    type: Sequelize.STRING,
  },
  unitRegistryLink: {
    type: Sequelize.STRING,
    required: true,
  },
  correspondingAdjustmentDeclaration: {
    type: Sequelize.STRING,
    required: true,
  },
  correspondingAdjustmentStatus: {
    type: Sequelize.STRING,
    required: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
