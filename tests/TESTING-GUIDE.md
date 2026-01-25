# Functional Testing Guide

## Overview

This testing framework provides automated functional tests for the Rallye Hiver application. These tests verify that the API endpoints work correctly in the production environment after deployments or major changes.

## When to Run Tests

You **MUST** run functional tests:

1. **After major code changes** - Especially changes to:
   - Authentication system
   - API endpoints
   - Database operations
   - Infrastructure configuration

2. **Before deploying to production** - Always run tests to catch issues early

3. **After deployment** - Verify everything works in the production environment

## Quick Start

### Run all tests from project root:

```bash
./run-functional-tests.sh
```

### Run from tests directory:

```bash
cd tests
npm test
```

## Test Results Interpretation

### All Tests Pass ✅
```
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```
✅ Safe to proceed with deployment or changes

### Some Tests Fail ❌
```
Test Suites: 1 failed, 1 total
Tests:       2 failed, 6 passed, 8 total
```
❌ **DO NOT DEPLOY** - Fix failing tests first

## Current Test Coverage

### Authentication Tests (8 tests)
- ✅ Successful login with valid credentials
- ✅ Login returns proper tokens (access, refresh, ID)
- ✅ Login returns user object with correct data
- ✅ Failed login with invalid email
- ✅ Failed login with invalid password
- ✅ Failed login with missing email
- ✅ Failed login with missing password
- ✅ Failed login with empty credentials
- ✅ Access protected endpoint with valid token
- ✅ Reject access to protected endpoint without token

## Test Configuration

Test configuration is in `tests/.env.test`:

```
API_URL=https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod
TEST_USER_EMAIL=functionaltest@rallyehiver.fr
TEST_USER_PASSWORD=FunctionalTest123
```

**Important**: The test user is automatically created on first run if it doesn't exist.

## Adding New Tests

When adding new features, create corresponding tests:

1. Create test file: `tests/[feature]/[feature-name].test.js`
2. Follow existing patterns in `auth/signin.test.js`
3. Test both success and error cases
4. Update this guide with new test coverage

Example:
```javascript
import { describe, test, expect } from '@jest/globals';
import APIClient from '../helpers/api-client.js';

describe('Feature Name', () => {
  let client;

  beforeAll(() => {
    client = new APIClient();
  });

  test('should do something successfully', async () => {
    const response = await client.post('/endpoint', { data: 'value' });
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('expectedField');
  });

  test('should handle errors properly', async () => {
    const response = await client.post('/endpoint', { invalid: 'data' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
  });
});
```

## Troubleshooting

### Tests fail with "Missing Authentication Token"
- **Problem**: API URL is incorrect
- **Solution**: Check `API_URL` in `.env.test` matches deployment URL

### Tests fail with "User pool client does not exist"
- **Problem**: Backend using old Cognito credentials
- **Solution**: Update `backend/.env` with current User Pool ID and Client ID

### Tests fail with connection errors
- **Problem**: API is not accessible
- **Solution**: Verify API is deployed and accessible

### Test user creation fails
- **Problem**: User may already exist (this is OK)
- **Solution**: Tests will continue and use existing user

## Best Practices

1. **Keep tests independent** - Each test should work standalone
2. **Test both success and failure** - Verify error handling
3. **Clean up test data** - Remove any data created during tests
4. **Use descriptive names** - Test names should explain what they verify
5. **Update after changes** - When you change an endpoint, update its tests

## CI/CD Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run Functional Tests
  run: |
    cd tests
    npm install
    npm test
```

## Future Test Coverage

Planned additions:
- Team management tests (create, join, approve, reject)
- Payment flow tests
- Content access tests
- Edge cases and race conditions
