-- MySQL dump of v2 CAD Trust Database
-- Simulated data

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Create program table
CREATE TABLE `program` (
  `cad_trust_program_id` varchar(36) NOT NULL,
  `program_name` varchar(255) NOT NULL,
  `program_registry` varchar(255) NOT NULL,
  `program_registry_activity_id` varchar(255) NOT NULL,
  `program_registry_program_id` varchar(255) DEFAULT NULL,
  `program_description` text,
  `org_uid` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_program_id`),
  KEY `program_name` (`program_name`),
  KEY `program_registry` (`program_registry`),
  KEY `program_registry_activity_id` (`program_registry_activity_id`),
  KEY `program_org_uid` (`org_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create methodology table
CREATE TABLE `methodology` (
  `cad_trust_methodology_id` varchar(36) NOT NULL,
  `methodology_code` varchar(255) NOT NULL,
  `methodology_name` varchar(255) NOT NULL,
  `methodology_version` varchar(255) DEFAULT NULL,
  `methodology_date` date DEFAULT NULL,
  `methodology_link` text,
  `methodology_type` varchar(255) DEFAULT NULL,
  `org_uid` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_methodology_id`),
  KEY `methodology_org_uid` (`org_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create project table
CREATE TABLE `project` (
  `cad_trust_project_id` varchar(36) NOT NULL,
  `org_uid` varchar(64) NOT NULL,
  `project_registry_name` varchar(255) NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `project_crediting_program` varchar(255) DEFAULT NULL,
  `project_name` varchar(255) NOT NULL,
  `project_link` text,
  `project_description` text,
  `project_sector` varchar(255) DEFAULT NULL,
  `project_type` varchar(255) DEFAULT NULL,
  `project_subtype` varchar(255) DEFAULT NULL,
  `project_status` varchar(255) DEFAULT NULL,
  `project_status_date` date DEFAULT NULL,
  `project_unit_metric` varchar(255) DEFAULT NULL,
  `cad_trust_reference_project_id` varchar(255) DEFAULT NULL,
  `cad_trust_program_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_project_id`),
  KEY `org_uid` (`org_uid`),
  KEY `project_registry_name` (`project_registry_name`),
  KEY `project_id` (`project_id`),
  KEY `project_name` (`project_name`),
  KEY `project_sector` (`project_sector`),
  KEY `project_type` (`project_type`),
  KEY `project_status` (`project_status`),
  KEY `cad_trust_program_id` (`cad_trust_program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create validation table
CREATE TABLE `validation` (
  `cad_trust_validation_id` varchar(36) NOT NULL,
  `validation_id` varchar(255) NOT NULL,
  `validation_type` varchar(255) DEFAULT NULL,
  `validation_body` varchar(255) DEFAULT NULL,
  `validation_date` date DEFAULT NULL,
  `validation_credit_period_start_date` date DEFAULT NULL,
  `validation_credit_period_end_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_validation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create verification table
CREATE TABLE `verification` (
  `cad_trust_verification_id` varchar(36) NOT NULL,
  `verification_id` varchar(255) NOT NULL,
  `verification_start_date` date DEFAULT NULL,
  `verification_end_date` date DEFAULT NULL,
  `verification_body` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  `cad_trust_validation_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`cad_trust_verification_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create location table
CREATE TABLE `location` (
  `cad_trust_location_id` varchar(36) NOT NULL,
  `location_country` varchar(255) DEFAULT NULL,
  `location_region` varchar(255) DEFAULT NULL,
  `location_gis` text,
  `location_map_type` text,
  `location_map_file_link` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create issuance table
CREATE TABLE `issuance` (
  `cad_trust_issuance_id` varchar(36) NOT NULL,
  `issuance_id` varchar(255) NOT NULL,
  `issuance_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_verification_id` varchar(36) NOT NULL,
  `cad_trust_methodology_id` varchar(36) NOT NULL,
  `cad_trust_location_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`cad_trust_issuance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create unit table
CREATE TABLE `unit` (
  `cad_trust_unit_id` varchar(36) NOT NULL,
  `org_uid` varchar(64) NOT NULL,
  `unit_serial_id` varchar(255) NOT NULL,
  `unit_start_block` varchar(255) NOT NULL,
  `unit_end_block` varchar(255) NOT NULL,
  `unit_count` decimal(20,2) DEFAULT NULL,
  `unit_type` varchar(255) DEFAULT NULL,
  `unit_vintage_year` int NOT NULL,
  `unit_status` varchar(255) DEFAULT NULL,
  `unit_status_reason` text,
  `unit_status_date` date DEFAULT NULL,
  `unit_retirement_detail` text,
  `unit_retirement_beneficiary` varchar(255) DEFAULT NULL,
  `unit_retirement_beneficiary_id` varchar(255) DEFAULT NULL,
  `unit_link` text,
  `unit_metric` varchar(255) DEFAULT NULL,
  `unit_current_owner` varchar(255) DEFAULT NULL,
  `unit_itmos_reference_id` varchar(255) DEFAULT NULL,
  `marketplace` varchar(255) DEFAULT NULL,
  `marketplace_link` varchar(255) DEFAULT NULL,
  `marketplace_identifier` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_issuance_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_unit_id`),
  KEY `org_uid` (`org_uid`),
  KEY `unit_serial_id` (`unit_serial_id`),
  KEY `unit_vintage_year` (`unit_vintage_year`),
  KEY `unit_status` (`unit_status`),
  KEY `cad_trust_issuance_id` (`cad_trust_issuance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create stakeholder table
CREATE TABLE `stakeholder` (
  `cad_trust_stakeholder_id` varchar(36) NOT NULL,
  `stakeholder_name` varchar(255) NOT NULL,
  `stakeholder_type` varchar(255) DEFAULT NULL,
  `stakeholder_link` text,
  `org_uid` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_stakeholder_id`),
  KEY `stakeholder_org_uid` (`org_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create stakeholder_projects table
CREATE TABLE `stakeholder_projects` (
  `cad_trust_stakeholder_project_id` varchar(36) NOT NULL,
  `cad_trust_stakeholder_id` varchar(36) NOT NULL,
  `cad_trust_project_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_stakeholder_project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create label table
CREATE TABLE `label` (
  `cad_trust_label_id` varchar(36) NOT NULL,
  `label_name` varchar(255) NOT NULL,
  `label_type` varchar(255) DEFAULT NULL,
  `label_link` text,
  `label_date` date DEFAULT NULL,
  `org_uid` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_label_id`),
  KEY `label_org_uid` (`org_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create unit_label table
CREATE TABLE `unit_label` (
  `cad_trust_unit_label_id` varchar(36) NOT NULL,
  `cad_trust_label_id` varchar(36) NOT NULL,
  `cad_trust_unit_id` varchar(36) NOT NULL,
  `label_unit_date` date DEFAULT NULL,
  `label_unit_description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_unit_label_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create co_benefit table
CREATE TABLE `co_benefit` (
  `cad_trust_co_benefit_id` varchar(36) NOT NULL,
  `co_benefit_id` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_co_benefit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create estimation table
CREATE TABLE `estimation` (
  `cad_trust_estimation_id` varchar(36) NOT NULL,
  `estimation_start_date` date NOT NULL,
  `esitmation_end_date` date NOT NULL,
  `estimation_unit_count` decimal(20,2) DEFAULT NULL,
  `estimation_reference_no` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_estimation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create rating table
CREATE TABLE `rating` (
  `cad_trust_rating_id` varchar(36) NOT NULL,
  `rating_type` varchar(255) DEFAULT NULL,
  `rating_name` varchar(255) NOT NULL,
  `rating_value` varchar(255) NOT NULL,
  `rating_link` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cad_trust_project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`cad_trust_rating_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create project_methodology table
CREATE TABLE `project_methodology` (
  `cad_trust_project_methodology_id` varchar(36) NOT NULL,
  `cad_trust_project_id` varchar(36) NOT NULL,
  `cad_trust_methodology_id` varchar(36) NOT NULL,
  `project_methodology_date` date DEFAULT NULL,
  `project_methodology_description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cad_trust_project_methodology_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create audit table
CREATE TABLE `audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_uid` varchar(255) NOT NULL,
  `registry_id` varchar(255) NOT NULL,
  `root_hash` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `change` text,
  `table` varchar(255) DEFAULT NULL,
  `onchain_confirmation_time_stamp` varchar(255) NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  `generation` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `org_uid` (`org_uid`),
  KEY `generation` (`generation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- INSERT SAMPLE DATA
-- =============================================================================

-- Insert program
INSERT INTO `program` (`cad_trust_program_id`, `program_name`, `program_registry`, `program_registry_activity_id`, `program_registry_program_id`, `program_description`, `org_uid`, `created_at`, `updated_at`) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CarbonExample Standard', 'CarbonExample', 'CES', 'CES-001', 'Voluntary Carbon Standard for greenhouse gas emission reduction projects', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW());

-- Insert methodologies
INSERT INTO `methodology` (`cad_trust_methodology_id`, `methodology_code`, `methodology_name`, `methodology_version`, `methodology_date`, `methodology_link`, `methodology_type`, `org_uid`, `created_at`, `updated_at`) VALUES
('m101-1234-5678-90ab-cdef12345678', 'CES-0007', 'Reducing Emissions from Deforestation and Degradation', 'v3.2', '2014-05-01', 'https://carbonexample.org/methodology/ces-0007', 'REDD+', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('m202-2345-6789-01bc-def234567890', 'CES-0042', 'Methodology for Improved Agricultural Land Management', 'v1.1', '2018-08-15', 'https://carbonexample.org/methodology/ces-0042', 'Agriculture', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('m303-3456-7890-12cd-ef3456789012', 'CES-D009', 'Afforestation, Reforestation, and Revegetation', 'v1.0', '2012-01-15', 'https://carbonexample.org/methodology/ces-d009', 'Forestry', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW());

-- Insert 5 projects with supporting data
-- Project 1: REDD+ Forest Conservation in Brazil
INSERT INTO `project` (`cad_trust_project_id`, `org_uid`, `project_registry_name`, `project_id`, `project_crediting_program`, `project_name`, `project_link`, `project_description`, `project_sector`, `project_type`, `project_subtype`, `project_status`, `project_status_date`, `project_unit_metric`, `cad_trust_reference_project_id`, `cad_trust_program_id`, `created_at`, `updated_at`) VALUES
('p001-1234-5678-90ab-cdef12345678', 'a807e453-6524-49df-a32d-785e56cf5600', 'CarbonExample', 'CES-1401', 'CES', 'Amazon Basin Forest Conservation Initiative', 'https://registry.carbonexample.org/app/projectDetail/CES/1401', 'A REDD+ project protecting 50,000 hectares of Amazon rainforest through sustainable forest management and community engagement', 'Forestry', 'REDD', 'REDD+', 'Registered', '2020-03-15', 'tCO2e', 'CarbonExampleCES1401-def12345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW(), NOW());

INSERT INTO `validation` (`cad_trust_validation_id`, `validation_id`, `validation_type`, `validation_body`, `validation_date`, `validation_credit_period_start_date`, `validation_credit_period_end_date`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('v101-1111-2222-3333-444455556666', 'VAL-2020-001', 'Initial', 'TÜV-SÜD', '2020-03-15', '2020-01-01', '2024-12-31', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678');

INSERT INTO `verification` (`cad_trust_verification_id`, `verification_id`, `verification_start_date`, `verification_end_date`, `verification_body`, `created_at`, `updated_at`, `cad_trust_project_id`, `cad_trust_validation_id`) VALUES
('ve101-1111-2222-3333-444455556666', 'VER-2021-Q1', '2021-03-01', '2021-03-15', 'TÜV-SÜD', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678', 'v101-1111-2222-3333-444455556666');

INSERT INTO `location` (`cad_trust_location_id`, `location_country`, `location_region`, `location_gis`, `location_map_type`, `location_map_file_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('l101-1111-2222-3333-444455556666', 'Brazil', 'Para', '{-54.2354, -3.4653}', 'geojson', 'https://registry.example.com/maps/project001.geojson', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678');

INSERT INTO `issuance` (`cad_trust_issuance_id`, `issuance_id`, `issuance_date`, `created_at`, `updated_at`, `cad_trust_verification_id`, `cad_trust_methodology_id`, `cad_trust_location_id`) VALUES
('i101-1111-2222-3333-444455556666', 'ISS-2021-Q1-001', '2021-04-01', NOW(), NOW(), 've101-1111-2222-3333-444455556666', 'm101-1234-5678-90ab-cdef12345678', 'l101-1111-2222-3333-444455556666'),
('i102-1111-2222-3333-444455556667', 'ISS-2021-Q2-001', '2021-07-15', NOW(), NOW(), 've101-1111-2222-3333-444455556666', 'm101-1234-5678-90ab-cdef12345678', 'l101-1111-2222-3333-444455556666');

INSERT INTO `unit` (`cad_trust_unit_id`, `org_uid`, `unit_serial_id`, `unit_start_block`, `unit_end_block`, `unit_count`, `unit_type`, `unit_vintage_year`, `unit_status`, `unit_status_reason`, `unit_status_date`, `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id`, `unit_link`, `unit_metric`, `unit_current_owner`, `unit_itmos_reference_id`, `marketplace`, `marketplace_link`, `marketplace_identifier`, `created_at`, `updated_at`, `cad_trust_issuance_id`) VALUES
('u001-1111-2222-3333-444455556666', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-1401-CEU-2021-0001', 'BLK001', 'BLK050', 125000.00, 'CEU', 2020, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/1401-2020-001', 'tCO2e', NULL, NULL, 'Demo Marketplace', 'http://climateWarehouse.com/myMarketplace', 'AKFEE3', NOW(), NOW(), 'i101-1111-2222-3333-444455556666'),
('u002-1111-2222-3333-444455556667', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-1401-CEU-2021-0002', 'BLK051', 'BLK100', 125000.00, 'CEU', 2020, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/1401-2020-002', 'tCO2e', NULL, NULL, 'Tokenized on Chia', NULL, 'CHIA-TOKEN-12345', NOW(), NOW(), 'i101-1111-2222-3333-444455556666'),
('u003-1111-2222-3333-444455556668', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-1401-CEU-2021-0003', 'BLK101', 'BLK150', 125000.00, 'CEU', 2021, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/1401-2021-001', 'tCO2e', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'i102-1111-2222-3333-444455556667');

-- Project 2: Clean Cookstoves in Kenya
INSERT INTO `project` (`cad_trust_project_id`, `org_uid`, `project_registry_name`, `project_id`, `project_crediting_program`, `project_name`, `project_link`, `project_description`, `project_sector`, `project_type`, `project_subtype`, `project_status`, `project_status_date`, `project_unit_metric`, `cad_trust_reference_project_id`, `cad_trust_program_id`, `created_at`, `updated_at`) VALUES
('p002-2234-5678-90ab-cdef12345678', 'a807e453-6524-49df-a32d-785e56cf5600', 'CarbonExample', 'CES-2856', 'CES', 'Kenya Clean Cookstoves Program', 'https://registry.carbonexample.org/app/projectDetail/CES/2856', 'Distributing improved cookstoves to rural households, reducing wood fuel consumption and indoor air pollution', 'Energy', 'Household Devices', 'Clean Cookstoves', 'Registered', '2019-06-20', 'tCO2e', 'CarbonExampleCES2856-def12345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW(), NOW());

INSERT INTO `validation` (`cad_trust_validation_id`, `validation_id`, `validation_type`, `validation_body`, `validation_date`, `validation_credit_period_start_date`, `validation_credit_period_end_date`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('v201-2222-3333-4444-555566667777', 'VAL-2019-045', 'Initial', 'SGS', '2019-06-20', '2019-01-01', '2028-12-31', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678');

INSERT INTO `verification` (`cad_trust_verification_id`, `verification_id`, `verification_start_date`, `verification_end_date`, `verification_body`, `created_at`, `updated_at`, `cad_trust_project_id`, `cad_trust_validation_id`) VALUES
('ve201-2222-3333-4444-555566667777', 'VER-2020-Q1', '2020-03-01', '2020-03-20', 'SGS', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678', 'v201-2222-3333-4444-555566667777'),
('ve202-2222-3333-4444-555566667778', 'VER-2021-Q1', '2021-03-01', '2021-03-20', 'SGS', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678', 'v201-2222-3333-4444-555566667777');

INSERT INTO `location` (`cad_trust_location_id`, `location_country`, `location_region`, `location_gis`, `location_map_type`, `location_map_file_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('l201-2222-3333-4444-555566667777', 'Kenya', 'Kisumu County', '{36.8167, -0.1022}', 'kml', 'https://registry.example.com/maps/kenya-cookstoves.kml', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678');

INSERT INTO `issuance` (`cad_trust_issuance_id`, `issuance_id`, `issuance_date`, `created_at`, `updated_at`, `cad_trust_verification_id`, `cad_trust_methodology_id`, `cad_trust_location_id`) VALUES
('i201-2222-3333-4444-555566667777', 'ISS-2020-003', '2020-05-01', NOW(), NOW(), 've201-2222-3333-4444-555566667777', 'm202-2345-6789-01bc-def234567890', 'l201-2222-3333-4444-555566667777'),
('i202-2222-3333-4444-555566667778', 'ISS-2021-003', '2021-05-01', NOW(), NOW(), 've202-2222-3333-4444-555566667778', 'm202-2345-6789-01bc-def234567890', 'l201-2222-3333-4444-555566667777');

INSERT INTO `unit` (`cad_trust_unit_id`, `org_uid`, `unit_serial_id`, `unit_start_block`, `unit_end_block`, `unit_count`, `unit_type`, `unit_vintage_year`, `unit_status`, `unit_status_reason`, `unit_status_date`, `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id`, `unit_link`, `unit_metric`, `unit_current_owner`, `unit_itmos_reference_id`, `marketplace`, `marketplace_link`, `marketplace_identifier`, `created_at`, `updated_at`, `cad_trust_issuance_id`) VALUES
('u201-2222-3333-4444-555566667777', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-2856-CEU-2020-0001', 'BLK001', 'BLK025', 45230.50, 'CEU', 2019, 'Retired', 'Voluntary offset', '2022-01-15', 'Corporate climate commitment', 'Acme Corporation', 'ACME-001', 'https://registry.carbonexample.org/app/unitDetail/CEU/2856-2019-001', 'tCO2e', 'Acme Corporation', NULL, NULL, NULL, NULL, NOW(), NOW(), 'i201-2222-3333-4444-555566667777'),
('u202-2222-3333-4444-555566667778', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-2856-CEU-2021-0001', 'BLK026', 'BLK050', 48200.25, 'CEU', 2020, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/2856-2020-001', 'tCO2e', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'i202-2222-3333-4444-555566667778');

-- Project 3: Wind Power in India
INSERT INTO `project` (`cad_trust_project_id`, `org_uid`, `project_registry_name`, `project_id`, `project_crediting_program`, `project_name`, `project_link`, `project_description`, `project_sector`, `project_type`, `project_subtype`, `project_status`, `project_status_date`, `project_unit_metric`, `cad_trust_reference_project_id`, `cad_trust_program_id`, `created_at`, `updated_at`) VALUES
('p003-3234-5678-90ab-cdef12345678', 'a807e453-6524-49df-a32d-785e56cf5600', 'CarbonExample', 'CES-1827', 'CES', 'Tamil Nadu Wind Farm Cluster', 'https://registry.carbonexample.org/app/projectDetail/CES/1827', 'A 125MW wind energy project generating clean electricity and displacing fossil fuel-based power generation', 'Energy', 'Renewable Energy', 'Wind', 'Registered', '2018-11-10', 'MWh', 'CarbonExampleCES1827-def12345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW(), NOW());

INSERT INTO `validation` (`cad_trust_validation_id`, `validation_id`, `validation_type`, `validation_body`, `validation_date`, `validation_credit_period_start_date`, `validation_credit_period_end_date`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('v301-3333-4444-5555-666677778888', 'VAL-2018-087', 'Initial', 'Bureau Veritas', '2018-11-10', '2018-04-01', '2027-03-31', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678');

INSERT INTO `verification` (`cad_trust_verification_id`, `verification_id`, `verification_start_date`, `verification_end_date`, `verification_body`, `created_at`, `updated_at`, `cad_trust_project_id`, `cad_trust_validation_id`) VALUES
('ve301-3333-4444-5555-666677778888', 'VER-2019-057', '2019-04-01', '2019-04-30', 'Bureau Veritas', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678', 'v301-3333-4444-5555-666677778888'),
('ve302-3333-4444-5555-666677778889', 'VER-2020-057', '2020-04-01', '2020-04-30', 'Bureau Veritas', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678', 'v301-3333-4444-5555-666677778888');

INSERT INTO `location` (`cad_trust_location_id`, `location_country`, `location_region`, `location_gis`, `location_map_type`, `location_map_file_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('l301-3333-4444-5555-666677778888', 'India', 'Tamil Nadu', '{79.8448, 10.5842}', 'geojson', 'https://registry.example.com/maps/tamil-nadu-wind.geojson', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678');

INSERT INTO `issuance` (`cad_trust_issuance_id`, `issuance_id`, `issuance_date`, `created_at`, `updated_at`, `cad_trust_verification_id`, `cad_trust_methodology_id`, `cad_trust_location_id`) VALUES
('i301-3333-4444-5555-666677778888', 'ISS-2019-124', '2019-06-15', NOW(), NOW(), 've301-3333-4444-5555-666677778888', 'm202-2345-6789-01bc-def234567890', 'l301-3333-4444-5555-666677778888'),
('i302-3333-4444-5555-666677778889', 'ISS-2020-124', '2020-06-15', NOW(), NOW(), 've302-3333-4444-5555-666677778889', 'm202-2345-6789-01bc-def234567890', 'l301-3333-4444-5555-666677778888');

INSERT INTO `unit` (`cad_trust_unit_id`, `org_uid`, `unit_serial_id`, `unit_start_block`, `unit_end_block`, `unit_count`, `unit_type`, `unit_vintage_year`, `unit_status`, `unit_status_reason`, `unit_status_date`, `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id`, `unit_link`, `unit_metric`, `unit_current_owner`, `unit_itmos_reference_id`, `marketplace`, `marketplace_link`, `marketplace_identifier`, `created_at`, `updated_at`, `cad_trust_issuance_id`) VALUES
('u301-3333-4444-5555-666677778888', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-1827-CEU-2019-0001', 'BLK001', 'BLK030', 187500.75, 'CEU', 2018, 'Retired', 'Corporate climate action', '2021-12-20', 'Annual sustainability report', 'Global Corp', 'GC-2021-001', 'https://registry.carbonexample.org/app/unitDetail/CEU/1827-2018-001', 'MWh', 'Global Corp', NULL, NULL, NULL, NULL, NOW(), NOW(), 'i301-3333-4444-5555-666677778888'),
('u302-3333-4444-5555-666677778889', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-1827-CEU-2020-0001', 'BLK031', 'BLK062', 192000.00, 'CEU', 2019, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/1827-2019-001', 'MWh', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'i302-3333-4444-5555-666677778889');

-- Project 4: Afforestation in Chile
INSERT INTO `project` (`cad_trust_project_id`, `org_uid`, `project_registry_name`, `project_id`, `project_crediting_program`, `project_name`, `project_link`, `project_description`, `project_sector`, `project_type`, `project_subtype`, `project_status`, `project_status_date`, `project_unit_metric`, `cad_trust_reference_project_id`, `cad_trust_program_id`, `created_at`, `updated_at`) VALUES
('p004-4234-5678-90ab-cdef12345678', 'a807e453-6524-49df-a32d-785e56cf5600', 'CarbonExample', 'CES-2108', 'CES', 'Patagonia Native Species Reforestation', 'https://registry.carbonexample.org/app/projectDetail/CES/2108', 'Reforestation project using native species to restore degraded lands in southern Chile, creating carbon sinks and biodiversity habitat', 'Forestry', 'ARR', 'Afforestation', 'Registered', '2021-02-28', 'tCO2e', 'CarbonExampleCES2108-def12345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW(), NOW());

INSERT INTO `validation` (`cad_trust_validation_id`, `validation_id`, `validation_type`, `validation_body`, `validation_date`, `validation_credit_period_start_date`, `validation_credit_period_end_date`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('v401-4444-5555-6666-777788889999', 'VAL-2021-023', 'Initial', 'TÜV-NORD', '2021-02-28', '2021-01-01', '2030-12-31', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678');

INSERT INTO `verification` (`cad_trust_verification_id`, `verification_id`, `verification_start_date`, `verification_end_date`, `verification_body`, `created_at`, `updated_at`, `cad_trust_project_id`, `cad_trust_validation_id`) VALUES
('ve401-4444-5555-6666-777788889999', 'VER-2022-Q1', '2022-02-01', '2022-03-15', 'TÜV-NORD', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678', 'v401-4444-5555-6666-777788889999');

INSERT INTO `location` (`cad_trust_location_id`, `location_country`, `location_region`, `location_gis`, `location_map_type`, `location_map_file_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('l401-4444-5555-6666-777788889999', 'Chile', 'Los Lagos', '{-71.8641, -41.4111}', 'shp', 'https://registry.example.com/maps/chile-reforestation.shp', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678');

INSERT INTO `issuance` (`cad_trust_issuance_id`, `issuance_id`, `issuance_date`, `created_at`, `updated_at`, `cad_trust_verification_id`, `cad_trust_methodology_id`, `cad_trust_location_id`) VALUES
('i401-4444-5555-6666-777788889999', 'ISS-2022-045', '2022-04-30', NOW(), NOW(), 've401-4444-5555-6666-777788889999', 'm303-3456-7890-12cd-ef3456789012', 'l401-4444-5555-6666-777788889999');

INSERT INTO `unit` (`cad_trust_unit_id`, `org_uid`, `unit_serial_id`, `unit_start_block`, `unit_end_block`, `unit_count`, `unit_type`, `unit_vintage_year`, `unit_status`, `unit_status_reason`, `unit_status_date`, `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id`, `unit_link`, `unit_metric`, `unit_current_owner`, `unit_itmos_reference_id`, `created_at`, `updated_at`, `cad_trust_issuance_id`) VALUES
('u401-4444-5555-6666-777788889999', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-2108-CEU-2022-0001', 'BLK001', 'BLK040', 45000.00, 'CEU', 2021, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/2108-2021-001', 'tCO2e', NULL, NULL, NOW(), NOW(), 'i401-4444-5555-6666-777788889999');

-- Project 5: Agricultural Soil Carbon in USA
INSERT INTO `project` (`cad_trust_project_id`, `org_uid`, `project_registry_name`, `project_id`, `project_crediting_program`, `project_name`, `project_link`, `project_description`, `project_sector`, `project_type`, `project_subtype`, `project_status`, `project_status_date`, `project_unit_metric`, `cad_trust_reference_project_id`, `cad_trust_program_id`, `created_at`, `updated_at`) VALUES
('p005-5234-5678-90ab-cdef12345678', 'a807e453-6524-49df-a32d-785e56cf5600', 'CarbonExample', 'CES-3150', 'CES', 'Iowa Regenerative Agriculture Program', 'https://registry.carbonexample.org/app/projectDetail/CES/3150', 'Program promoting no-till farming, cover crops, and rotational grazing to increase soil organic carbon across 10,000 acres of farmland', 'Agriculture', 'Agriculture', 'Soil Carbon', 'Registered', '2020-09-15', 'tCO2e', 'CarbonExampleCES3150-def12345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW(), NOW());

INSERT INTO `validation` (`cad_trust_validation_id`, `validation_id`, `validation_type`, `validation_body`, `validation_date`, `validation_credit_period_start_date`, `validation_credit_period_end_date`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('v501-5555-6666-7777-888899990000', 'VAL-2020-156', 'Initial', 'ClimateCHECK', '2020-09-15', '2020-01-01', '2029-12-31', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678');

INSERT INTO `verification` (`cad_trust_verification_id`, `verification_id`, `verification_start_date`, `verification_end_date`, `verification_body`, `created_at`, `updated_at`, `cad_trust_project_id`, `cad_trust_validation_id`) VALUES
('ve501-5555-6666-7777-888899990000', 'VER-2021-089', '2021-09-01', '2021-10-15', 'ClimateCHECK', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678', 'v501-5555-6666-7777-888899990000');

INSERT INTO `location` (`cad_trust_location_id`, `location_country`, `location_region`, `location_gis`, `location_map_type`, `location_map_file_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('l501-5555-6666-7777-888899990000', 'USA', 'Iowa', '{-93.0977, 42.0347}', 'geojson', 'https://registry.example.com/maps/iowa-agriculture.geojson', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678');

INSERT INTO `issuance` (`cad_trust_issuance_id`, `issuance_id`, `issuance_date`, `created_at`, `updated_at`, `cad_trust_verification_id`, `cad_trust_methodology_id`, `cad_trust_location_id`) VALUES
('i501-5555-6666-7777-888899990000', 'ISS-2021-203', '2021-11-30', NOW(), NOW(), 've501-5555-6666-7777-888899990000', 'm202-2345-6789-01bc-def234567890', 'l501-5555-6666-7777-888899990000');

INSERT INTO `unit` (`cad_trust_unit_id`, `org_uid`, `unit_serial_id`, `unit_start_block`, `unit_end_block`, `unit_count`, `unit_type`, `unit_vintage_year`, `unit_status`, `unit_status_reason`, `unit_status_date`, `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id`, `unit_link`, `unit_metric`, `unit_current_owner`, `unit_itmos_reference_id`, `marketplace`, `marketplace_link`, `marketplace_identifier`, `created_at`, `updated_at`, `cad_trust_issuance_id`) VALUES
('u501-5555-6666-7777-888899990000', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-3150-CEU-2021-0001', 'BLK001', 'BLK070', 87500.00, 'CEU', 2020, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/3150-2020-001', 'tCO2e', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'i501-5555-6666-7777-888899990000'),
('u502-5555-6666-7777-888899990001', 'a807e453-6524-49df-a32d-785e56cf5600', 'CES-3150-CEU-2021-0002', 'BLK071', 'BLK140', 87500.00, 'CEU', 2020, 'Active', NULL, NULL, NULL, NULL, NULL, 'https://registry.carbonexample.org/app/unitDetail/CEU/3150-2020-002', 'tCO2e', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), 'i501-5555-6666-7777-888899990000');

-- Additional data: Stakeholders
INSERT INTO `stakeholder` (`cad_trust_stakeholder_id`, `stakeholder_name`, `stakeholder_type`, `stakeholder_link`, `org_uid`, `created_at`, `updated_at`) VALUES
('st101-1111-1111-1111-111111111111', 'Amazon Rainforest Trust', 'Project Developer', 'https://www.amazonforest.org', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('st201-2222-2222-2222-222222222222', 'Kenya Energy Agency', 'Government', 'https://www.kenyaenergy.go.ke', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('st301-3333-3333-3333-333333333333', 'India Wind Power Consortium', 'Private', 'https://www.indiawind.com', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('st401-4444-4444-4444-444444444444', 'Chile Forestry Department', 'Government', 'https://www.chileforestry.gov', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('st501-5555-5555-5555-555555555555', 'Iowa Farmers Cooperative', 'Collective', 'https://www.iowacooperative.com', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW());

INSERT INTO `stakeholder_projects` (`cad_trust_stakeholder_project_id`, `cad_trust_stakeholder_id`, `cad_trust_project_id`, `created_at`, `updated_at`) VALUES
('sp001-1111-1111-1111-111111111111', 'st101-1111-1111-1111-111111111111', 'p001-1234-5678-90ab-cdef12345678', NOW(), NOW()),
('sp002-2222-2222-2222-222222222222', 'st201-2222-2222-2222-222222222222', 'p002-2234-5678-90ab-cdef12345678', NOW(), NOW()),
('sp003-3333-3333-3333-333333333333', 'st301-3333-3333-3333-333333333333', 'p003-3234-5678-90ab-cdef12345678', NOW(), NOW()),
('sp004-4444-4444-4444-444444444444', 'st401-4444-4444-4444-444444444444', 'p004-4234-5678-90ab-cdef12345678', NOW(), NOW()),
('sp005-5555-5555-5555-555555555555', 'st501-5555-5555-5555-555555555555', 'p005-5234-5678-90ab-cdef12345678', NOW(), NOW());

-- Additional data: Labels
INSERT INTO `label` (`cad_trust_label_id`, `label_name`, `label_type`, `label_link`, `label_date`, `org_uid`, `created_at`, `updated_at`) VALUES
('la001-1111-1111-1111-111111111111', 'Gold Standard', 'Certification', 'https://www.goldstandard.org', '2021-01-15', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('la002-2222-2222-2222-222222222222', 'CCB Standard', 'Co-benefits', 'https://www.climate-standards.org', '2020-06-20', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW()),
('la003-3333-3333-3333-333333333333', 'SD Vista', 'SDG Alignment', 'https://www.sdvista.org', '2021-03-10', 'a807e453-6524-49df-a32d-785e56cf5600', NOW(), NOW());

INSERT INTO `unit_label` (`cad_trust_unit_label_id`, `cad_trust_label_id`, `cad_trust_unit_id`, `label_unit_date`, `label_unit_description`, `created_at`, `updated_at`) VALUES
('ul001-1111-1111-1111-111111111111', 'la002-2222-2222-2222-222222222222', 'u001-1111-2222-3333-444455556666', '2021-05-01', 'Verified community benefits', NOW(), NOW()),
('ul002-2222-2222-2222-222222222222', 'la003-3333-3333-3333-333333333333', 'u201-2222-3333-4444-555566667777', '2020-05-05', 'SDG 7: Affordable and Clean Energy', NOW(), NOW());

-- Additional data: Co-benefits
INSERT INTO `co_benefit` (`cad_trust_co_benefit_id`, `co_benefit_id`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('cb001-1111-1111-1111-111111111111', 'Biodiversity Conservation', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678'),
('cb002-2222-2222-2222-222222222222', 'Community Development', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678'),
('cb003-3333-3333-3333-333333333333', 'Improved Air Quality', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678'),
('cb004-4444-4444-4444-444444444444', 'Water Conservation', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678'),
('cb005-5555-5555-5555-555555555555', 'Soil Health', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678');

-- Additional data: Estimations
INSERT INTO `estimation` (`cad_trust_estimation_id`, `estimation_start_date`, `esitmation_end_date`, `estimation_unit_count`, `estimation_reference_no`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('es001-1111-1111-1111-111111111111', '2020-01-01', '2024-12-31', 500000.00, 'EST-2020-001', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678'),
('es002-2222-2222-2222-222222222222', '2019-01-01', '2028-12-31', 280000.00, 'EST-2019-015', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678'),
('es003-3333-3333-3333-333333333333', '2018-04-01', '2027-03-31', 220000.00, 'EST-2018-088', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678'),
('es004-4444-4444-4444-444444444444', '2021-01-01', '2030-12-31', 180000.00, 'EST-2021-024', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678'),
('es005-5555-5555-5555-555555555555', '2020-01-01', '2029-12-31', 350000.00, 'EST-2020-157', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678');

-- Additional data: Ratings
INSERT INTO `rating` (`cad_trust_rating_id`, `rating_type`, `rating_name`, `rating_value`, `rating_link`, `created_at`, `updated_at`, `cad_trust_project_id`) VALUES
('rt001-1111-1111-1111-111111111111', 'CDP', 'Environmental Impact Rating', 'AAA', 'https://ratings.example.com/env/rating001', NOW(), NOW(), 'p001-1234-5678-90ab-cdef12345678'),
('rt002-2222-2222-2222-222222222222', 'CCQI', 'Social Impact Assessment', 'AA', 'https://ratings.example.com/social/rating002', NOW(), NOW(), 'p002-2234-5678-90ab-cdef12345678'),
('rt003-3333-3333-3333-333333333333', 'CDP', 'Additionality Verification', 'AAA', 'https://ratings.example.com/add/rating003', NOW(), NOW(), 'p003-3234-5678-90ab-cdef12345678'),
('rt004-4444-4444-4444-444444444444', 'CCQI', 'Permanence Evaluation', 'AA', 'https://ratings.example.com/perm/rating004', NOW(), NOW(), 'p004-4234-5678-90ab-cdef12345678'),
('rt005-5555-5555-5555-555555555555', 'CDP', 'Verification Quality Review', 'AAA', 'https://ratings.example.com/ver/rating005', NOW(), NOW(), 'p005-5234-5678-90ab-cdef12345678');

-- Additional data: Project-Methodology relationships
INSERT INTO `project_methodology` (`cad_trust_project_methodology_id`, `cad_trust_project_id`, `cad_trust_methodology_id`, `project_methodology_date`, `project_methodology_description`, `created_at`, `updated_at`) VALUES
('pm001-1111-1111-1111-111111111111', 'p001-1234-5678-90ab-cdef12345678', 'm101-1234-5678-90ab-cdef12345678', '2020-03-15', 'Primary methodology for project implementation', NOW(), NOW()),
('pm002-2222-2222-2222-222222222222', 'p002-2234-5678-90ab-cdef12345678', 'm202-2345-6789-01bc-def234567890', '2019-06-20', 'Clean cookstoves methodology application', NOW(), NOW()),
('pm003-3333-3333-3333-333333333333', 'p003-3234-5678-90ab-cdef12345678', 'm202-2345-6789-01bc-def234567890', '2018-11-10', 'Renewable energy project methodology', NOW(), NOW()),
('pm004-4444-4444-4444-444444444444', 'p004-4234-5678-90ab-cdef12345678', 'm303-3456-7890-12cd-ef3456789012', '2021-02-28', 'Afforestation methodology with native species', NOW(), NOW()),
('pm005-5555-5555-5555-555555555555', 'p005-5234-5678-90ab-cdef12345678', 'm202-2345-6789-01bc-def234567890', '2020-09-15', 'Soil carbon sequestration through regenerative practices', NOW(), NOW());

-- Insert audit records tracking blockchain changes
-- Note: These simulate audit records from the blockchain datalayer sync process
-- org_uid: UUID format (Chia datalayer organization singleton ID)
-- registry_id: 64-character hex string (Chia datalayer store ID)
-- Generation numbers increment as new blockchain transactions are recorded
INSERT INTO `audit` (`id`, `org_uid`, `registry_id`, `root_hash`, `type`, `change`, `table`, `onchain_confirmation_time_stamp`, `author`, `comment`, `generation`, `created_at`, `updated_at`) VALUES
-- Generation 0: Registry creation
(1, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890ab', 'CREATE REGISTRY', NULL, NULL, '2020-01-15T10:30:00.000000', 'System', 'Initial registry creation', 0, NOW(), NOW()),

-- Project registrations (Generations 1-5)
(2, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcd', 'INSERT', '{"warehouseProjectId":"p001-1234-5678-90ab-cdef12345678","projectName":"Amazon Basin Forest Conservation Initiative"}', 'projects', '2020-03-15T14:22:00.000000', 'admin@carbonexample.org', 'Project registration submitted', 1, NOW(), NOW()),
(3, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcde', 'INSERT', '{"warehouseProjectId":"p002-2234-5678-90ab-cdef12345678","projectName":"Kenya Clean Cookstoves Program"}', 'projects', '2019-06-20T11:15:00.000000', 'admin@carbonexample.org', 'Project registration', 2, NOW(), NOW()),
(4, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'INSERT', '{"warehouseProjectId":"p003-3234-5678-90ab-cdef12345678","projectName":"Tamil Nadu Wind Farm Cluster"}', 'projects', '2018-11-10T16:30:00.000000', 'admin@carbonexample.org', 'Project registration', 3, NOW(), NOW()),
(5, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12', 'INSERT', '{"warehouseProjectId":"p004-4234-5678-90ab-cdef12345678","projectName":"Patagonia Native Species Reforestation"}', 'projects', '2021-02-28T10:00:00.000000', 'admin@carbonexample.org', 'Project registration', 4, NOW(), NOW()),
(6, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234', 'INSERT', '{"warehouseProjectId":"p005-5234-5678-90ab-cdef12345678","projectName":"Iowa Regenerative Agriculture Program"}', 'projects', '2020-09-15T14:00:00.000000', 'admin@carbonexample.org', 'Project registration', 5, NOW(), NOW()),

-- Unit issuances (Generations 6-15)
(7, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456', 'INSERT', '{"warehouseUnitId":"u001-1111-2222-3333-444455556666","unitSerialId":"CES-1401-CEU-2021-0001"}', 'units', '2021-04-01T09:45:00.000000', 'admin@carbonexample.org', 'Unit issuance recorded', 6, NOW(), NOW()),
(8, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567', 'INSERT', '{"warehouseUnitId":"u002-1111-2222-3333-444455556667","unitSerialId":"CES-1401-CEU-2021-0002"}', 'units', '2021-04-01T09:46:00.000000', 'admin@carbonexample.org', 'Unit issuance', 7, NOW(), NOW()),
(9, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x90abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678', 'INSERT', '{"warehouseUnitId":"u003-1111-2222-3333-444455556668","unitSerialId":"CES-1401-CEU-2021-0003"}', 'units', '2021-07-15T14:30:00.000000', 'admin@carbonexample.org', 'Unit issuance', 8, NOW(), NOW()),
(10, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x0abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789', 'INSERT', '{"warehouseUnitId":"u201-2222-3333-4444-555566667777","unitSerialId":"CES-2856-CEU-2020-0001"}', 'units', '2020-05-01T10:15:00.000000', 'admin@carbonexample.org', 'Unit issuance', 9, NOW(), NOW()),
(11, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x1bcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'INSERT', '{"warehouseUnitId":"u202-2222-3333-4444-555566667778","unitSerialId":"CES-2856-CEU-2021-0001"}', 'units', '2021-05-01T11:20:00.000000', 'admin@carbonexample.org', 'Unit issuance', 10, NOW(), NOW()),
(12, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x2cdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901', 'INSERT', '{"warehouseUnitId":"u301-3333-4444-5555-666677778888","unitSerialId":"CES-1827-CEU-2019-0001"}', 'units', '2019-06-15T13:00:00.000000', 'admin@carbonexample.org', 'Unit issuance', 11, NOW(), NOW()),
(13, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x3def1234567890abcdef1234567890abcdef1234567890abcdef123456789012', 'INSERT', '{"warehouseUnitId":"u302-3333-4444-5555-666677778889","unitSerialId":"CES-1827-CEU-2020-0001"}', 'units', '2020-06-15T14:00:00.000000', 'admin@carbonexample.org', 'Unit issuance', 12, NOW(), NOW()),
(14, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x4ef1234567890abcdef1234567890abcdef1234567890abcdef1234567890123', 'INSERT', '{"warehouseUnitId":"u401-4444-5555-6666-777788889999","unitSerialId":"CES-2108-CEU-2022-0001"}', 'units', '2022-04-30T09:00:00.000000', 'admin@carbonexample.org', 'Unit issuance', 13, NOW(), NOW()),
(15, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x5f1234567890abcdef1234567890abcdef1234567890abcdef12345678901234', 'INSERT', '{"warehouseUnitId":"u501-5555-6666-7777-888899990000","unitSerialId":"CES-3150-CEU-2021-0001"}', 'units', '2021-11-30T15:00:00.000000', 'admin@carbonexample.org', 'Unit issuance', 14, NOW(), NOW()),
(16, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x61234567890abcdef1234567890abcdef1234567890abcdef123456789012345', 'INSERT', '{"warehouseUnitId":"u502-5555-6666-7777-888899990001","unitSerialId":"CES-3150-CEU-2021-0002"}', 'units', '2021-11-30T15:05:00.000000', 'admin@carbonexample.org', 'Unit issuance', 15, NOW(), NOW()),

-- Unit retirements (Generations 16-17)
(17, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x7234567890abcdef1234567890abcdef1234567890abcdef1234567890123456', 'UPDATE', '{"warehouseUnitId":"u201-2222-3333-4444-555566667777","unitStatus":"Retired"}', 'units', '2022-01-15T13:20:00.000000', 'admin@carbonexample.org', 'Unit retirement processed', 16, NOW(), NOW()),
(18, 'a807e453-6524-49df-a32d-785e56cf5600', '9144c974e146920088514534c89371dc269d1b894a2c7f6cedeb80b804c6cd02', '0x834567890abcdef1234567890abcdef1234567890abcdef12345678901234567', 'UPDATE', '{"warehouseUnitId":"u301-3333-4444-5555-666677778888","unitStatus":"Retired"}', 'units', '2021-12-20T15:30:00.000000', 'admin@carbonexample.org', 'Corporate climate action retirement', 17, NOW(), NOW());

COMMIT;
