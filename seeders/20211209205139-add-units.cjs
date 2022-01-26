'use strict';
const UnitStub = require('../src/models/units/units.stub.json');
const LabelUnitStub = require('../src/models/labelUnits/labelUnits.stub.json');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('units', UnitStub, {});
    await queryInterface.bulkInsert('label_unit', LabelUnitStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('units');
  },
};
