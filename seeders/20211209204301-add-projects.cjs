'use strict';
const ProjectStub = require('../src/models/projects/projects.stub.json');

module.exports = {
  up: async (queryInterface) =>
    queryInterface.bulkInsert('Projects', ProjectStub, {}),
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Projects');
  },
};
