# V2 Test Suite

This directory contains a comprehensive test suite for the V2 API implementation, following the same testing strategy and format as the V1 tests but with enhanced coverage and additional test scenarios.

## Test Structure

```
tests/v2/
├── integration/           # End-to-end integration tests
│   └── v2-integration.spec.js
├── resources/             # Individual resource CRUD tests
│   ├── program.spec.js
│   ├── project.spec.js
│   ├── unit.spec.js
│   ├── staging.spec.js
│   └── audit.spec.js
├── system/                # System table tests
│   └── v2-system.spec.js
├── validation/            # Validation and error handling tests
│   └── v2-validation.spec.js
├── test-data/             # Test data files
│   ├── new-program.js
│   ├── new-project.js
│   ├── new-unit.js
│   ├── new-validation.js
│   ├── new-verification.js
│   ├── new-issuance.js
│   ├── new-methodology.js
│   ├── new-location.js
│   ├── new-stakeholder.js
│   └── new-label.js
├── test-fixtures/         # Test utilities and fixtures
│   ├── v2-common-fixtures.js
│   ├── v2-project-fixtures.js
│   ├── v2-staging-fixtures.js
│   └── index.js
├── utils/                 # Test utilities
├── run-v2-tests.js       # Test runner script
└── README.md             # This file
```

## Test Categories

### 1. Resource Tests (`tests/v2/resources/`)

Tests for all 21 V2 data table resources, including:

- **CRUD Operations**: Create, Read, Update, Delete
- **Validation**: Required fields, data types, picklist validation
- **Error Handling**: Invalid data, missing fields, malformed requests
- **Edge Cases**: Special characters, large data, concurrent operations
- **Performance**: Bulk operations, large datasets

**Coverage:**
- ✅ Program resource (program.spec.js)
- ✅ Project resource (project.spec.js)
- ✅ Unit resource (unit.spec.js)
- ✅ Staging resource (staging.spec.js)
- ✅ Audit resource (audit.spec.js)
- 🔄 Additional resources (validation, verification, issuance, etc.)

### 2. Integration Tests (`tests/v2/integration/`)

End-to-end workflow tests including:

- **Complete Workflows**: Create → Update → Delete cycles
- **Cross-Resource Relationships**: Foreign key integrity
- **Staging Workflow**: Stage → Commit → Retry operations
- **Error Handling**: Cascading errors, concurrent operations
- **Performance**: Bulk operations, concurrent requests
- **Data Consistency**: Staging table consistency, diff validation

### 3. Validation Tests (`tests/v2/validation/`)

Comprehensive validation and error handling tests:

- **Timestamp Field Validation**: Rejection of createdAt/updatedAt in requests
- **Required Field Validation**: Missing required fields
- **Picklist Validation**: Valid/invalid picklist values
- **Data Type Validation**: Numeric, date, decimal field validation
- **String Length Validation**: Maximum/minimum string lengths
- **Foreign Key Validation**: Non-existent reference validation
- **Malformed Request Handling**: Invalid JSON, missing headers
- **Edge Cases**: Special characters, null values, concurrent validation

### 4. System Table Tests (`tests/v2/system/`)

Tests for V2 system tables:

- **Organizations**: CRUD operations, home org validation
- **Meta**: Key-value storage operations
- **Governance**: Governance data management
- **Simulator**: Simulator data operations
- **Error Handling**: Invalid operations, missing data
- **Performance**: Bulk operations, data consistency

## Test Data

### Test Data Files (`tests/v2/test-data/`)

Each resource has a corresponding test data file with realistic sample data:

- `new-program.js`: Program test data
- `new-project.js`: Project test data with all required fields
- `new-unit.js`: Unit test data with picklist values
- `new-validation.js`: Validation test data
- `new-verification.js`: Verification test data
- `new-issuance.js`: Issuance test data
- `new-methodology.js`: Methodology test data
- `new-location.js`: Location test data with GIS data
- `new-stakeholder.js`: Stakeholder test data
- `new-label.js`: Label test data

### Test Fixtures (`tests/v2/test-fixtures/`)

Enhanced test utilities and fixtures:

- `v2-common-fixtures.js`: Common V2 test utilities
- `v2-project-fixtures.js`: Project-specific test utilities
- `v2-staging-fixtures.js`: Staging-specific test utilities

## Running Tests

### Prerequisites

1. **Server Running**: V2 API server must be running on port 31310
2. **Database Setup**: V2 database must be initialized
3. **Dependencies**: All npm dependencies installed

### Test Commands

```bash
# Run all V2 tests
npm run test:v2

# Run specific test suites
npm run test:v2:resources      # Resource tests only
npm run test:v2:integration     # Integration tests only
npm run test:v2:validation      # Validation tests only
npm run test:v2:system          # System tests only

# Run individual test files
npx mocha tests/v2/resources/program.spec.js
npx mocha tests/v2/integration/v2-integration.spec.js

# Run with custom timeout
npx mocha tests/v2/**/*.spec.js --timeout 60000
```

### Test Runner Script

The `run-v2-tests.js` script provides enhanced test execution with:

- **Colored Output**: Color-coded test results
- **Progress Tracking**: Real-time test progress
- **Error Handling**: Graceful error handling and reporting
- **Suite Selection**: Run specific test suites or all tests

```bash
# Run all V2 tests with enhanced output
node tests/v2/run-v2-tests.js

# Run specific test suite
node tests/v2/run-v2-tests.js resources
node tests/v2/run-v2-tests.js integration
node tests/v2/run-v2-tests.js validation
node tests/v2/run-v2-tests.js system
```

## Test Features

### Enhanced Coverage

Compared to V1 tests, V2 tests include:

1. **Timestamp Field Validation**: Explicit testing of createdAt/updatedAt rejection
2. **Picklist Validation**: Comprehensive testing of all picklist fields
3. **Foreign Key Validation**: Testing of referential integrity
4. **Performance Testing**: Bulk operations and concurrent request handling
5. **Error Scenarios**: More comprehensive error handling tests
6. **Edge Cases**: Special characters, large data, concurrent operations

### Test Utilities

Enhanced test fixtures provide:

- **V2-Specific Utilities**: Tailored for V2 database and models
- **Staging Operations**: Complete staging workflow testing
- **Data Validation**: Comprehensive data structure validation
- **Performance Measurement**: Execution time tracking
- **Cleanup Operations**: Automated test data cleanup

### Test Data Management

- **Realistic Data**: Test data mirrors real-world scenarios
- **Foreign Key Relationships**: Proper relationship testing
- **Picklist Values**: Valid picklist values for all fields
- **Edge Case Data**: Special characters, large values, boundary conditions

## Test Configuration

### Timeouts

- **Default Timeout**: 30 seconds per test
- **Integration Tests**: Extended timeouts for complex workflows
- **Performance Tests**: Longer timeouts for bulk operations

### Test Environment

- **Database**: V2 SQLite database (`~/.chia/mainnet/cadt/v2/data.sqlite3`)
- **Server**: V2 API server on port 31310
- **Simulator**: Chia datalayer simulator for testing

### Test Isolation

- **Before Each**: Staging table cleanup
- **After All**: Complete test data cleanup
- **Organization**: Test-specific organization creation
- **Data**: Isolated test data per test suite

## Best Practices

### Writing Tests

1. **Follow V1 Patterns**: Maintain consistency with V1 test structure
2. **Use Fixtures**: Leverage test fixtures for common operations
3. **Test Edge Cases**: Include boundary conditions and error scenarios
4. **Validate Responses**: Check both success and error responses
5. **Clean Up**: Ensure proper test data cleanup

### Test Data

1. **Realistic Data**: Use realistic test data that mirrors production
2. **Valid Picklists**: Use valid picklist values from governance data
3. **Foreign Keys**: Maintain proper foreign key relationships
4. **Edge Cases**: Include special characters, large values, etc.

### Performance

1. **Bulk Operations**: Test with realistic data volumes
2. **Concurrent Requests**: Test concurrent operation handling
3. **Timeouts**: Use appropriate timeouts for different test types
4. **Resource Cleanup**: Ensure proper resource cleanup

## Troubleshooting

### Common Issues

1. **Server Not Running**: Ensure V2 API server is running on port 31310
2. **Database Issues**: Verify V2 database is initialized and accessible
3. **Timeout Errors**: Increase timeout for complex operations
4. **Cleanup Issues**: Ensure test data cleanup between tests

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npx mocha tests/v2/**/*.spec.js
```

### Test Isolation

If tests interfere with each other:

1. Check staging table cleanup in `beforeEach`
2. Verify test data cleanup in `after`
3. Ensure unique test data per test
4. Check for shared state between tests

## Contributing

### Adding New Tests

1. **Follow Structure**: Use existing test structure and patterns
2. **Add Fixtures**: Create fixtures for common operations
3. **Update Documentation**: Update this README with new tests
4. **Test Coverage**: Ensure comprehensive coverage of new functionality

### Test Standards

1. **Naming**: Use descriptive test names
2. **Organization**: Group related tests in describe blocks
3. **Assertions**: Use clear, specific assertions
4. **Error Messages**: Provide helpful error messages
5. **Documentation**: Document complex test scenarios

## Future Enhancements

### Planned Improvements

1. **Additional Resources**: Complete tests for all 21 data tables
2. **Offer System Tests**: Comprehensive offer/transfer testing
3. **Datalayer Integration**: End-to-end datalayer testing
4. **Performance Benchmarks**: Automated performance testing
5. **Test Coverage**: Code coverage reporting
6. **CI/CD Integration**: Automated test execution in CI/CD pipeline

### Test Automation

1. **Scheduled Testing**: Automated test execution
2. **Performance Monitoring**: Continuous performance testing
3. **Regression Testing**: Automated regression test detection
4. **Test Reporting**: Comprehensive test reporting and analytics
