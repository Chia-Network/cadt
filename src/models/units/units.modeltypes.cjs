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
  unitOwnerOrgUid: Sequelize.STRING,
  countryJuridictionOfOwner: Sequelize.STRING,
  inCountryJuridictionOfOwner: Sequelize.STRING,
  serialNumberBlock: Sequelize.STRING,
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
  cooresponingAdjustmentDeclaration: Sequelize.STRING,
  correspondingAdjustmentStatus: Sequelize.STRING,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
