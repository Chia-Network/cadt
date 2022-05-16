export default `
SELECT 
  p1.sector as sector,
  p1.warehouseProjectId as 'firstProjectId',
  p1.projectName as 'firstProjectName',
  p1.projectDeveloper as 'firstProjectDeveloper',
  p1.projectLink as 'firstProjectLink',
  p1.registryOfOrigin as 'firstProjectRegistry',
  i1.startDate as 'firstIssuanceStartDate',
  i1.endDate as 'firstIssuanceEndDate',
  p2.warehouseProjectId as 'secondProjectId',
  p2.projectName as 'secondProjectName',
  p2.projectDeveloper as 'secondProjectDeveloper',
  p2.projectLink as 'secondProjectLink',
  p2.registryOfOrigin as 'secondProjectRegistry',
  i2.startDate as 'secondIssuanceStartDate',
  i2.endDate as 'secondIssuanceEndDate'
FROM projects p1
JOIN projects p2 
INNER JOIN issuances i1 on p1.warehouseProjectId = i1.warehouseProjectId
INNER JOIN issuances i2 on p2.warehouseProjectId = i2.warehouseProjectId
INNER JOIN projectLocations l1 on l1.warehouseProjectId = p1.warehouseProjectId
INNER JOIN projectLocations l2 on l2.warehouseProjectId = p2.warehouseProjectId
WHERE p1.registryOfOrigin <> p2.registryOfOrigin -- looking for the same projects in different registries
AND p1.warehouseProjectId < p2.warehouseProjectId -- enforce strict ordering and avoid self-match
AND i1.startDate <= i2.endDate AND i1.endDate >= i2.startDate -- looking for issuances with overlapping dates
AND p1.sector = p2.sector -- same sector
AND l1.country = l2.country -- same country

`;
