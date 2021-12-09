'use strict';
const UnitStub = require('../src/models/units/units.stub.json');

module.exports = {
  up: async (queryInterface) =>
    queryInterface.bulkInsert('Units', UnitStub, {}),
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Units');
  },
};
