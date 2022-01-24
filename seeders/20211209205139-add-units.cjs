'use strict';
const UnitStub = require('../src/models/units/units.stub.json');
const QualificationUnitStub = require('../src/models/qualificationUnits/qualificationUnits.stub.json');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('units', UnitStub, {});
    await queryInterface.bulkInsert(
      'qualification_unit',
      QualificationUnitStub,
      {},
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('units');
  },
};
