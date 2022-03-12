'use strict';

import UnitStub from '../../models/units/units.stub.json';
import LabelUnitStub from '../../models/labelUnits/labelUnits.stub.json';

export default {
  // eslint-disable-next-line no-unused-vars
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('units', UnitStub, {});
    await queryInterface.bulkInsert('label_unit', LabelUnitStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('units');
  },
};
