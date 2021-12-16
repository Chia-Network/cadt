'use strict';
const UnitStub = require('../src/models/units/units.stub.json');
const JunctionStub = [
  {
    unitId: 1,
    qualificationId: 1,
  },
  {
    unitId: 1,
    qualificationId: 2,
  },
];
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('units', UnitStub, {});
    await queryInterface.bulkInsert('qualification_unit', JunctionStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('units');
  },
};
