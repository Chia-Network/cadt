'use strict';

/**
 * @typedef {Object} LocationV2Types
 * @property {string} cadTrustLocationId - Primary key UUID
 * @property {string} [locationCountry] - Country from picklist
 * @property {string} [locationRegion] - Region name
 * @property {string} [locationGis] - GIS data including lat/long
 * @property {string} [locationMapType] - Type of map file (e.g., geojson)
 * @property {string} [locationMapFileLink] - Datafile link
 * @property {Date} [createdAt] - Auto-generated timestamp
 * @property {Date} [updatedAt] - Auto-generated timestamp
 * @property {string} cadTrustProjectId - Foreign key to project table
 */

export default {};
