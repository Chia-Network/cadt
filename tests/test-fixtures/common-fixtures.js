import chai from 'chai';
const { expect } = chai;

import {
  RelatedProject,
  Label,
  Issuance,
  CoBenefit,
  ProjectLocation,
  Rating,
  Estimation,
} from '../../src/models';

import { POLLING_INTERVAL } from '../../src/datalayer';
const TEST_WAIT_TIME = POLLING_INTERVAL * 2;

// The node simulator runs on an async process, we are importing
// the WAIT_TIME constant from the simulator, padding it and waiting for the
// appropriate amount of time for the simulator to finish its operations
export const waitForDataLayerSync = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, TEST_WAIT_TIME * 2);
  });
};

export const childTablesIncludeOrgUid = (record) => {
  Object.keys(record).forEach((key) => {
    if (Array.isArray(record[key])) {
      record[key].forEach((childRecord) => {
        expect(record.orgUid).to.equal(childRecord.orgUid);
      });
    } else if (Boolean(record[key]) && typeof record[key] === 'object') {
      expect(record.orgUid).to.equal(record[key].orgUid);
    }
  });
};

// Since the primary key needs to be assigned in the controller
// this test will ensure its added when tested against the staging table
export const childTablesIncludePrimaryKey = (record) => {
  Object.keys(record).forEach((key) => {
    if (Array.isArray(record[key])) {
      record[key].forEach((childRecord) => {
        expect(childRecord.id).to.be.ok;
        expect(childRecord.id).to.be.an('string');
      });
    } else if (Boolean(record[key]) && typeof record[key] === 'object') {
      expect(record[key].id).to.be.ok;
      expect(record[key].id).to.be.an('string');
    }
  });
};

export const objectContainsSubSet = (obj, objSubset) => {
  Object.keys(objSubset).forEach((key) => {
    if (Array.isArray(objSubset[key])) {
      objSubset[key].forEach((childRecord, index) => {
        Object.keys(childRecord).forEach((childkey) => {
          expect(obj[key][index][childkey], childkey).to.deep.equal(
            objSubset[key][index][childkey],
          );
        });
      });
    } else if (Boolean(objSubset[key]) && typeof objSubset[key] === 'object') {
      Object.keys(objSubset[key]).forEach((childkey) => {
        expect(obj[key][childkey], childkey).to.deep.equal(
          objSubset[key][childkey],
        );
      });
    } else {
      expect(
        objSubset[key],
        `{${key}: ${objSubset[key]}} does not equal {${key}: ${obj[key]}}`,
      ).to.deep.equal(obj[key]);
    }
  });
};

export const assertChildTablesDontExist = async (record) => {
  return Promise.resolve(
    Object.keys(record).map(async (key) => {
      if (Array.isArray(record[key])) {
        await Promise.all(
          record[key].map(async (childRecord) => {
            if (key === 'issuances') {
              expect(await Issuance.findByPk(childRecord.id)).to.not.be.ok;
            }

            if (key === 'labels') {
              expect(await Label.findByPk(childRecord.id)).to.not.be.ok;
            }

            if (key === 'relatedProjects') {
              expect(await RelatedProject.findByPk(childRecord.id)).to.not.be
                .ok;
            }

            if (key === 'projectRatings') {
              expect(await Rating.findByPk(childRecord.id)).to.not.be.ok;
            }

            if (key === 'coBenefits') {
              expect(await CoBenefit.findByPk(childRecord.id)).to.not.be.ok;
            }

            if (key === 'estimations') {
              expect(await Estimation.findByPk(childRecord.id)).to.not.be.ok;
            }

            if (key === 'projectLocations') {
              expect(await ProjectLocation.findByPk(childRecord.id)).to.not.be
                .ok;
            }
          }),
        );
      } else if (typeof record[key] === 'object') {
        if (key === 'issuance') {
          expect(await Issuance.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'label') {
          expect(await Label.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'relatedProject') {
          expect(await RelatedProject.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'projectRating') {
          expect(await Rating.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'coBenefit') {
          expect(await CoBenefit.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'estimation') {
          expect(await Estimation.findByPk(record[key].id)).to.not.be.ok;
        }

        if (key === 'projectLocation') {
          expect(await ProjectLocation.findByPk(record[key].id)).to.not.be.ok;
        }
      }
    }),
  );
};
