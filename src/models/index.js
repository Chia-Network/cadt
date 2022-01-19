import { Project } from './projects';
import { CoBenefit } from './co-benefits';
import { ProjectLocation } from './locations';
import { Qualification } from './qualifications';
import { Rating } from './ratings';
import { RelatedProject } from './related-projects';
import { Unit } from './units';
import { Vintage } from './vintages';

Project.associate();
CoBenefit.associate();
ProjectLocation.associate();
Qualification.associate();
Rating.associate();
RelatedProject.associate();
Unit.associate();
Vintage.associate();

export * from './projects';
export * from './co-benefits';
export * from './locations';
export * from './ratings';
export * from './qualifications';
export * from './related-projects';
export * from './units';
export * from './vintages';
export * from './staging';
export * from './organizations';
export * from './meta';
