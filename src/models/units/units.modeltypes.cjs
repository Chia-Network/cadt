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
  unitBlockStart: Sequelize.STRING,
  unitBlockEnd: Sequelize.STRING,
  unitCount: Sequelize.INTEGER,
  countryJuridictionOfOwner: Sequelize.STRING,
  inCountryJuridictionOfOwner: Sequelize.STRING,
  intendedBuyerOrgUid: Sequelize.STRING,
  tags: Sequelize.STRING,
  tokenIssuanceHash: Sequelize.STRING,
  marketplaceIdentifier: Sequelize.STRING,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
