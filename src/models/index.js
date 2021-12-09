import { Project } from "./projects";
import { CoBenefit } from "./co-benefits";
import { ProjectLocation } from "./locations/index.js";
import { Qualification } from "./qualifications/index.js";
import { Rating } from "./ratings/index.js";
import { RelatedProject } from "./related-projects/index.js";
import { Staging } from "./staging/index.js";
import { Unit } from "./units/index.js";
import { Vintage } from "./vintages/index.js";

Project.associate();
CoBenefit.associate();
ProjectLocation.associate();
Qualification.associate();
Rating.associate();
RelatedProject.associate();
Staging.associate();
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
