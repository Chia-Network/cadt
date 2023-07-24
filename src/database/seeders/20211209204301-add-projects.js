'use strict';

import ProjectStub from '../../models/projects/projects.stub.js';
import CoBenifetStub from '../../models/co-benefits/co-benefits.stub.js';
import RelatedProjectStub from '../../models/related-projects/related-projects.stub.js/index.js';
import LabelStub from '../../models/labels/labels.stub.js';
import RatingsStub from '../../models/ratings/ratings.stub.js/index.js';
import IssuanceStub from '../../models/issuances/issuances.stub.js';
import LocationsStub from '../../models/locations/locations.stub.js';

export default {
  // eslint-disable-next-line no-unused-vars
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
