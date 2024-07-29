import { Project } from './projects/index.js';
import { CoBenefit } from './co-benefits/index.js';
import { ProjectLocation } from './locations/index.js';
import { Label } from './labels/index.js';
import { Rating } from './ratings/index.js';
import { RelatedProject } from './related-projects/index.js';
import { Unit } from './units/index.js';
import { Issuance } from './issuances/index.js';
import { Estimation } from './estimations/index.js';
import { LabelUnit } from './labelUnits/index.js';

Project.associate();
CoBenefit.associate();
ProjectLocation.associate();
Label.associate();
Rating.associate();
RelatedProject.associate();
Unit.associate();
Issuance.associate();
Estimation.associate();

export * from './projects/index.js';
export * from './co-benefits/index.js';
export * from './locations/index.js';
export * from './ratings/index.js';
export * from './labels/index.js';
export * from './related-projects/index.js';
export * from './units/index.js';
export * from './issuances/index.js';
export * from './staging/index.js';
export * from './organizations/index.js';
export * from './meta/index.js';
export * from './simulator/index.js';
export * from './labelUnits/index.js';
export * from './estimations/index.js';
export * from './audit/index.js';
export * from './governance/index.js';
export * from './file-store/index.js';

export const ModelKeys = {
  unit: Unit,
  units: Unit,
  label: Label,
  labels: Label,
  label_unit: LabelUnit,
  label_units: LabelUnit,
  labelUnit: LabelUnit,
  issuance: Issuance,
  issuances: Issuance,
  estimations: Estimation,
  coBenefits: CoBenefit,
  relatedProjects: RelatedProject,
  projects: Project,
  project: Project,
  projectRatings: Rating,
  projectLocations: ProjectLocation,
};
