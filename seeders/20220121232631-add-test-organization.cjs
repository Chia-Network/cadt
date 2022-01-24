'use strict';
const dotenv = require('dotenv');
dotenv.config();

const metaStub = [
  {
    metaKey: 'organizationId',
    metaValue: 'f1c54511-865e-4611-976c-7c3c1f704662',
  },
  {
    metaKey: 'organizationName',
    metaValue: 'Demo Org',
  },
];

module.exports = {
  up: async (queryInterface) => {
    if (process.env.USE_SIMULATOR === 'true') {
      await queryInterface.bulkInsert('meta', metaStub, {});
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('meta');
  },
};
