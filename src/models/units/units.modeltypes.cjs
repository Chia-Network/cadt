const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  warehouseUnitId: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  // The orgUid is teh singeltonId of the
  // organizations tables on the datalayer
  orgUid: Sequelize.STRING,
  unitOwner: Sequelize.STRING,
  countryJurisdictionOfOwner: Sequelize.STRING,
  inCountryJurisdictionOfOwner: Sequelize.STRING,
  serialNumberBlock: Sequelize.STRING,
  serialNumberPattern: {
    type: Sequelize.STRING,
    defaultValue: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
  },
  unitIdentifier: Sequelize.STRING,
  unitType: Sequelize.STRING,
  intendedBuyerOrgUid: Sequelize.STRING,
  marketplace: Sequelize.STRING,
  tags: Sequelize.STRING,
  unitStatus: Sequelize.STRING,
  unitTransactionType: Sequelize.STRING,
  unitStatusReason: Sequelize.STRING,
  tokenIssuanceHash: Sequelize.STRING,
  marketplaceIdentifier: Sequelize.STRING,
  unitsIssuanceLocation: Sequelize.STRING,
  unitRegistryLink: Sequelize.STRING,
  unitMarketplaceLink: Sequelize.STRING,
  correspondingAdjustmentDeclaration: Sequelize.STRING,
  correspondingAdjustmentStatus: Sequelize.STRING,
  issuanceId: Sequelize.STRING,
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
