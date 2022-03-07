'use strict';
const OrganizationStub = require('../src/models/organizations/organizations.stub.json');

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('organizations', OrganizationStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('organizations');
  },
};
