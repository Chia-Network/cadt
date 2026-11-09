import { v4 as uuidv4 } from 'uuid';
import * as models from '../../../src/models/v2/index.js';
import { getV2HomeOrgId } from './v2-test-helpers.js';

export const cascadeModels = [
  models.UnitLabelV2,
  models.UnitV2,
  models.IssuanceV2,
  models.VerificationV2,
  models.StakeholderProjectV2,
  models.ProjectMethodologyV2,
  models.LocationV2,
  models.EstimationV2,
  models.RatingV2,
  models.CoBenefitV2,
  models.ValidationV2,
  models.ProjectV2,
  models.ProgramV2,
  models.MethodologyV2,
  models.StakeholderV2,
  models.LabelV2,
];

// Explicit named branches make the expected member sets independent of discovery.
export const createCascadeFixture = async () => {
  const orgUid = await getV2HomeOrgId();
  const records = {};
  const add = async (name, model, values) => {
    const primaryKey = model.primaryKeyAttribute;
    const id = uuidv4();
    await model.create({ [primaryKey]: id, ...values });
    records[name] = {
      table: model.tableName,
      primaryKeyField: model.rawAttributes[primaryKey].field,
      id,
    };
    return id;
  };
  const program = await add('program', models.ProgramV2, {
    orgUid,
    programName: 'Shared program',
    programRegistry: 'Test',
    programRegistryActivityId: 'CAR-229',
  });
  const methodology = await add('methodology', models.MethodologyV2, {
    orgUid,
    methodologyCode: 'CAR-229',
    methodologyName: 'Shared methodology',
  });
  const stakeholder = await add('stakeholder', models.StakeholderV2, {
    orgUid,
    stakeholderName: 'Shared stakeholder',
  });
  const label = await add('label', models.LabelV2, {
    orgUid,
    labelName: 'Shared label',
  });

  for (const branch of ['a', 'b']) {
    const project = await add(`${branch}Project`, models.ProjectV2, {
      orgUid,
      projectRegistryName: 'Test',
      projectId: branch,
      projectName: branch,
      projectSector: ['Agriculture'],
      cadTrustProgramId: program,
    });
    const projectMethodology = await add(
      `${branch}Methodology`,
      models.ProjectMethodologyV2,
      {
        cadTrustProjectId: project,
        cadTrustMethodologyId: methodology,
      },
    );
    await add(`${branch}Stakeholder`, models.StakeholderProjectV2, {
      cadTrustProjectId: project,
      cadTrustStakeholderId: stakeholder,
    });
    await add(`${branch}Location`, models.LocationV2, {
      cadTrustProjectId: project,
    });
    await add(`${branch}Estimation`, models.EstimationV2, {
      cadTrustProjectId: project,
      estimationStartDate: '2024-01-01',
      estimationEndDate: '2024-12-31',
    });
    await add(`${branch}Rating`, models.RatingV2, {
      cadTrustProjectId: project,
      ratingName: 'Test',
      ratingValue: 'A',
    });
    await add(`${branch}CoBenefit`, models.CoBenefitV2, {
      cadTrustProjectId: project,
      coBenefitId: 'Test',
    });
    const validation = await add(`${branch}Validation`, models.ValidationV2, {
      cadTrustProjectId: project,
      validationId: branch,
      validationBody: 'AENOR International S.A.U.',
    });
    for (const suffix of branch === 'a' ? ['1', '2'] : ['1']) {
      const verificationName = `${branch}V${suffix}`;
      const verification = await add(verificationName, models.VerificationV2, {
        cadTrustProjectId: project,
        cadTrustValidationId: validation,
        verificationId: verificationName,
        verificationBody: 'AENOR International S.A.U.',
      });
      for (const issuanceSuffix of verificationName === 'aV1'
        ? ['1', '2']
        : ['1']) {
        const issuanceName = `${verificationName}I${issuanceSuffix}`;
        const issuance = await add(issuanceName, models.IssuanceV2, {
          cadTrustVerificationId: verification,
          cadTrustProjectMethodologyId: projectMethodology,
          issuanceId: issuanceName,
          issuanceDate: '2024-01-01',
        });
        for (const unitSuffix of issuanceName === 'aV1I1'
          ? ['1', '2']
          : ['1']) {
          const unitName = `${issuanceName}U${unitSuffix}`;
          const unit = await add(unitName, models.UnitV2, {
            orgUid,
            cadTrustIssuanceId: issuance,
            unitSerialId: unitName,
            unitStartBlock: '1',
            unitEndBlock: '10',
            unitVintageYear: 2024,
          });
          await add(`${unitName}Label`, models.UnitLabelV2, {
            cadTrustUnitId: unit,
            cadTrustLabelId: label,
          });
        }
      }
    }
  }

  const names = {
    project: [
      'aProject',
      'aMethodology',
      'aStakeholder',
      'aLocation',
      'aEstimation',
      'aRating',
      'aCoBenefit',
      'aValidation',
      'aV1',
      'aV2',
      'aV1I1',
      'aV1I2',
      'aV2I1',
      'aV1I1U1',
      'aV1I1U2',
      'aV1I2U1',
      'aV2I1U1',
      'aV1I1U1Label',
      'aV1I1U2Label',
      'aV1I2U1Label',
      'aV2I1U1Label',
    ],
    verification: [
      'aV1',
      'aV1I1',
      'aV1I2',
      'aV1I1U1',
      'aV1I1U2',
      'aV1I2U1',
      'aV1I1U1Label',
      'aV1I1U2Label',
      'aV1I2U1Label',
    ],
    issuance: ['aV1I1', 'aV1I1U1', 'aV1I1U2', 'aV1I1U1Label', 'aV1I1U2Label'],
    unit: ['aV1I1U1', 'aV1I1U1Label'],
  };
  return {
    records,
    expected: Object.fromEntries(
      Object.entries(names).map(([table, members]) => [
        table,
        members.map((name) => records[name]),
      ]),
    ),
  };
};
