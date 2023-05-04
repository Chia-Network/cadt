'use strict';

import ProjectStub from '../../models/projects/projects.stub.json' assert { type: 'json' };
import CoBenifetStub from '../../models/co-benefits/co-benefits.stub.json' assert { type: 'json' };
import RelatedProjectStub from '../../models/related-projects/related-projects.stub.json' assert { type: 'json' };
import LabelStub from '../../models/labels/labels.stub.json' assert { type: 'json' };
import RatingsStub from '../../models/ratings/ratings.stub.json' assert { type: 'json' };
import IssuanceStub from '../../models/issuances/issuances.stub.json' assert { type: 'json' };
import LocationsStub from '../../models/locations/locations.stub.json' assert { type: 'json' };

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
