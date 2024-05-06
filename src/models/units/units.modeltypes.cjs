const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  warehouseUnitId: {
    type: Sequelize.STRING,
    allowNull: false,
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
  //There doesn't appear to be a reference to label ID. We must reference labels table to understand if any labels get applied to specific units.
  // Please insert reference to labels table.
  unitOwner: {
    type: Sequelize.STRING,
  },
  countryJurisdictionOfOwner: {
    type: Sequelize.STRING,
    required: true,
  },
  inCountryJurisdictionOfOwner: {
    type: Sequelize.STRING,
  },
  serialNumberBlock: {
    type: Sequelize.STRING,
    required: true,
  },
  unitBlockStart: {
    type: Sequelize.STRING,
    required: true,
  },
  unitBlockEnd: {
    type: Sequelize.STRING,
    required: true,
  },
  unitCount: {
    type: Sequelize.INTEGER,
    required: true,
  },
  vintageYear: {
    type: Sequelize.INTEGER,
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
    type: Sequelize.TEXT,
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
  timeStaged: {
    type: Sequelize.STRING,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: true,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: true,
  },
};
