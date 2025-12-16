#!/usr/bin/env node
/**
 * Script to generate test files for all endpoints
 * Based on the methodology-validation.spec.js template
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Endpoint configurations
const endpoints = [
  { name: 'program', endpoint: 'program', idField: 'cadTrustProgramId', hasDependencies: false },
  { name: 'project', endpoint: 'project', idField: 'cadTrustProjectId', hasDependencies: true, dependsOn: ['program'] },
  { name: 'location', endpoint: 'location', idField: 'cadTrustLocationId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'stakeholder', endpoint: 'stakeholder', idField: 'cadTrustStakeholderId', hasDependencies: false },
  { name: 'label', endpoint: 'label', idField: 'cadTrustLabelId', hasDependencies: false },
  { name: 'estimation', endpoint: 'estimation', idField: 'cadTrustEstimationId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'rating', endpoint: 'rating', idField: 'cadTrustRatingId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'co-benefit', endpoint: 'co-benefit', idField: 'cadTrustCoBenefitId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'validation', endpoint: 'validation', idField: 'cadTrustValidationId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'verification', endpoint: 'verification', idField: 'cadTrustVerificationId', hasDependencies: true, dependsOn: ['project'] },
  { name: 'issuance', endpoint: 'issuance', idField: 'cadTrustIssuanceId', hasDependencies: true, dependsOn: ['verification', 'methodology'] },
  { name: 'unit', endpoint: 'unit', idField: 'cadTrustUnitId', hasDependencies: true, dependsOn: ['issuance'] },
  { name: 'project-methodology', endpoint: 'project-methodology', idField: null, hasDependencies: true, dependsOn: ['project', 'methodology'], isComposite: true },
  { name: 'stakeholder-projects', endpoint: 'stakeholder-projects', idField: 'cadTrustStakeholderProjectId', hasDependencies: true, dependsOn: ['stakeholder', 'project'] },
  { name: 'unit-label', endpoint: 'unit-label', idField: null, hasDependencies: true, dependsOn: ['label', 'unit'], isComposite: true },
  { name: 'aef-t1-submission', endpoint: 'aef-t1-submission', idField: 'cadTrustAefT1SubmissionId', hasDependencies: false },
  { name: 'aef-t2-authorizations', endpoint: 'aef-t2-authorizations', idField: 'cadTrustAefT2AuthorizationId', hasDependencies: false },
  { name: 'aef-t3-actions', endpoint: 'aef-t3-actions', idField: 'cadTrustAefT3ActionId', hasDependencies: false },
  { name: 'aef-t4-holdings', endpoint: 'aef-t4-holdings', idField: 'cadTrustAefT4HoldingId', hasDependencies: false },
  { name: 'aef-t5-authorized-entities', endpoint: 'aef-t5-authorized-entities', idField: 'cadTrustAefT5AuthorizedEntityId', hasDependencies: false },
];

// Read template
const templatePath = path.join(__dirname, 'methodology-validation.spec.js');
const template = fs.readFileSync(templatePath, 'utf8');

// Generate test files for each endpoint
for (const config of endpoints) {
  const pascalName = config.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const camelName = config.name.split('-').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');

  // Replace template variables
  let content = template
    .replace(/Methodology/g, pascalName)
    .replace(/methodology/g, camelName)
    .replace(/\/v2\/methodology/g, `/v2/${config.endpoint}`)
    .replace(/cadTrustMethodologyId/g, config.idField || 'id')
    .replace(/generateMethodology/g, `generate${pascalName}`)
    .replace(/generateMethodologyMinimal/g, `generate${pascalName}Minimal`)
    .replace(/generateMethodologyMaximal/g, `generate${pascalName}Maximal`)
    .replace(/generateMethodologyLongStrings/g, `generate${pascalName}LongStrings`)
    .replace(/generateMethodologyInvalidPicklist/g, `generate${pascalName}InvalidPicklist`)
    .replace(/generateMethodologyForbiddenFields/g, `generate${pascalName}ForbiddenFields`)
    .replace(/methodologyCode/g, config.name.includes('project') ? 'projectId' : config.name.includes('program') ? 'programName' : `${camelName}Name`)
    .replace(/methodologyName/g, config.name.includes('project') ? 'projectName' : config.name.includes('program') ? 'programRegistry' : `${camelName}Name`);

  // Write file
  const outputPath = path.join(__dirname, `${config.name}-validation.spec.js`);
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Generated: ${outputPath}`);
}

console.log('All test files generated!');
