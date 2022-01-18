'use strict';
const UnitStub = require('../src/models/units/units.stub.json');
const JunctionStub = [
  {
    warehouseUnitId: '5c960ac1-a180-45a4-9850-be177e26d2fb',
    qualificationId: '702cafbb-c624-4273-9cdc-c617ad5675df',
  },
  {
    warehouseUnitId: '5c960ac1-a180-45a4-9850-be177e26d2fb',
    qualificationId: '76903895-840e-406c-b2a0-f90244acf02d',
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
