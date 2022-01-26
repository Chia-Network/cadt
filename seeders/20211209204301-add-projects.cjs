'use strict';
const ProjectStub = require('../src/models/projects/projects.stub.json');
const CoBenifetStub = require('../src/models/co-benefits/co-benefits.stub.json');
const RelatedProjectStub = require('../src/models/related-projects/related-projects.stub.json');
const LabelStub = require('../src/models/labels/labels.stub.json');
const RatingsStub = require('../src/models/ratings/ratings.stub.json');
const IssuanceStub = require('../src/models/issuances/issuances.stub.json');
const LocationsStub = require('../src/models/locations/locations.stub.json');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('projects', ProjectStub, {});
    await queryInterface.bulkInsert('coBenefits', CoBenifetStub, {});
    await queryInterface.bulkInsert('relatedProjects', RelatedProjectStub, {});
    await queryInterface.bulkInsert('labels', LabelStub, {});
    await queryInterface.bulkInsert('projectRatings', RatingsStub, {});
    await queryInterface.bulkInsert('issuances', IssuanceStub, {});
    await queryInterface.bulkInsert('projectLocations', LocationsStub, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('projects');
  },
};
