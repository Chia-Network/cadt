'use strict';

import OrganizationStub from '../../models/organizations/organizations.stub.json' assert { type: 'json' };

export default {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('organizations', OrganizationStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('organizations');
  },
};
