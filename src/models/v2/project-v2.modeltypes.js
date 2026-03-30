// V2 Project Model Types
const ProjectV2Types = {
  cadTrustProjectId: 'INTEGER',
  projectRegistryName: 'STRING',
  projectId: 'STRING',
  projectCreditingProgram: 'STRING',
  projectName: 'STRING',
  projectLink: 'TEXT',
  projectDescription: 'TEXT',
  projectSector: 'STRING',
  projectType: 'TEXT', // JSON array of strings
  projectSubtype: 'STRING',
  projectStatus: 'STRING',
  projectStatusDate: 'DATEONLY',
  projectUnitMetric: 'STRING',
  cadTrustReferenceProjectId: 'STRING',
  cadTrustProgramId: 'INTEGER',
  createdAt: 'DATE',
  updatedAt: 'DATE',
};

export default ProjectV2Types;
