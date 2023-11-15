import superagent from 'superagent';
import Logger from '@chia-carbon/core-registry-logger';
import wallet from './datalayer/wallet';

const logger = new Logger({
  namespace: 'stress-test',
  projectName: 'stress-test',
  logLevel: 'trace',
  packageVersion: 1.0,
});

const projectData = {
  projectId: 'c9d147e2-bc07-4e68-a76d-43424fa8cd4e',
  registryOfOrigin: 'Singapore National Registry',
  currentRegistry: 'Singapore National Registry',
  originProjectId: 'Singapore National Registry',
  program: 'Restoration & Conservation',
  projectName: 'Sungei Buloh Wetlands Conservation',
  projectLink: 'https://www.nature.com/articles/s41467-021-21560-2',
  projectDeveloper:
    "NParks' National Biodiversity Centre, National Parks Board, Ridgeview Residential College",
  sector: 'Transport',
  projectType: 'Organic Waste Composting',
  projectTags: 'Wetlands, Reforestation, Million trees',
  coveredByNDC: 'Inside NDC',
  ndcInformation:
    'The restoration and conservation project directly aligns to the Singaporean NDC goals to capture 1,000,000 tons of carbon by 2050. This project represents an estimated contribution of 27% towards the NDC.',
  projectStatus: 'Registered',
  projectStatusDate: '2022-01-31T00:05:45.701Z',
  unitMetric: 'tCO2e',
  methodology:
    'Recovery and utilization of gas from oil fields that would otherwise be flared or vented --- Version 7.0',
  methodology2:
    'Recovery and utilization of gas from oil fields that would otherwise be flared or vented --- Version 7.0',
  validationBody: 'SCS Global Services',
  validationDate: '2021-06-01T17:00:45.701Z',
  projectLocations: [
    {
      country: 'Singapore',
      inCountryRegion: 'N/A',
      geographicIdentifier: '1°26′46″N 103°43′44″E',
    },
  ],
  labels: [
    {
      label: 'Green-e® Climate Standard Endorsement',
      labelType: 'Endorsement',
      creditingPeriodStartDate: '2021-06-01T00:00:00.701Z',
      creditingPeriodEndDate: '2031-05-30T23:59:59.701Z',
      validityPeriodStartDate: '2021-01-01T00:08:00.701Z',
      validityPeriodEndDate: '2025-12-31T23:59:59.701Z',
      unitQuantity: 1200,
      labelLink: 'https://www.green-e.org/programs/climate',
    },
  ],
  coBenefits: [
    {
      cobenefit:
        'Biodiversity through planting a variety of trees that are home to many native Singaporean species',
    },
  ],
  relatedProjects: [
    {
      relatedProjectId: 'A34398',
      relationshipType: 'Pasir Ris Park Conservation',
      registry: 'Singapore National Registry',
    },
  ],
  projectRatings: [
    {
      ratingType: 'CCQI',
      ratingRangeHighest: 'A',
      ratingRangeLowest: 'Z',
      rating: 'G',
      ratingLink: 'https://www.cdp.net/en/cities/cities-scores',
    },
  ],
  estimations: [
    {
      creditingPeriodStart: '2021-06-01T00:00:00.701Z',
      creditingPeriodEnd: '2031-05-30T23:59:59.701Z',
      unitCount: 27000,
    },
  ],
};

const unitData = {
  unitOwner: 'f1c54511-865e-4611-976c-7c3c1f704662',
  countryJurisdictionOfOwner: 'Netherlands',
  projectLocationId: 'lkjw2er1-nj23-1212-532-dsjdx5-k131',
  inCountryJurisdictionOfOwner: 'California',
  unitCount: 10,
  vintageYear: 2016,
  unitType: 'Removal - nature',
  marketplace: 'California Carbon',
  marketplaceLink: 'https://www.californiacarbon.info/',
  marketplaceIdentifier: 'CCMT405',
  unitTags: 'CC&S, Sequestration, carbon bury',
  unitStatus: 'Held',
  unitStatusReason: 'N/A',
  unitRegistryLink:
    'https://www.climateactionreserve.org/about-us/california-climate-action-registry/',
  correspondingAdjustmentDeclaration: 'Committed',
  correspondingAdjustmentStatus: 'Not Started',
  labels: [
    {
      warehouseProjectId: '11954678-f7a5-47d2-94f8-f4f3138a529c',
      label: 'Green-e® Climate COC certification',
      labelType: 'Certification',
      creditingPeriodStartDate: '2014-01-10T00:05:45.701Z',
      creditingPeriodEndDate: '2019-01-09T00:05:45.701Z',
      validityPeriodStartDate: '2014-02-01T00:05:45.701Z',
      validityPeriodEndDate: '2019-01-31T00:05:45.701Z',
      unitQuantity: 7,
      labelLink: 'https://www.green-e.org/programs/climate',
    },
  ],
  issuance: {
    warehouseProjectId: '11954678-f7a5-47d2-94f8-f4f3138a529c',
    startDate: '2014-01-01T00:05:45.701Z',
    endDate: '2019-01-31T00:05:45.701Z',
    verificationApproach: 'CO2 Detection Satelite',
    verificationReportDate: '2016-06-15T00:05:45.701Z',
    verificationBody: 'Carbon Mapper',
  },
};

const start = async () => {
  try {
    const projectIds = [];
    for (let i = 0; i < 20; i++) {
      console.log(`Creating project ${i}`);
      const response = await superagent
        .post(`http://127.0.0.1:31310/v1/projects`)
        .send(projectData);
      const data = response.body;
      projectIds.push(data.uuid);
    }

    for (const projectId of projectIds) {
      console.log(`Creating units for project ${projectId}`);
      const unit = Object.assign({}, unitData);
      unit.issuance.warehouseProjectId = projectId;
      await superagent.post(`http://127.0.0.1:31310/v1/units`).send(unit);
      await superagent.post(`http://127.0.0.1:31310/v1/units`).send(unit);
    }

    await wallet.waitForAllTransactionsToConfirm();
    const response = await superagent.post(
      `http://127.0.0.1:31310/v1/staging/commit`,
    );
    console.log(response.body);
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await wallet.waitForAllTransactionsToConfirm();

    logger.info(`End of function`);
    start();
  } catch {
    await superagent.delete(`http://127.0.0.1:31310/v1/staging/clean`);
    start();
  }
};

start();
