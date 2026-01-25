# Rallye Hiver Functional Tests

This directory contains functional tests for the Rallye Hiver application. These tests verify that the API endpoints work correctly in the production environment.

## Setup

1. Install dependencies:
```bash
cd tests
npm install
```

2. Configure test environment:
Edit `.env.test` to set the correct API URL and test user credentials.

**IMPORTANT**: Create a dedicated test user in your production environment. Do NOT use real user credentials for testing.

## Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test:watch
```

Run tests with coverage:
```bash
npm test:coverage
```

## Test Structure

- `auth/` - Authentication tests (login, signup, etc.)
- `teams/` - Team management tests
- `payments/` - Payment integration tests
- `content/` - Content access tests
- `helpers/` - Shared test utilities
- `config/` - Test configuration

## Writing New Tests

1. Create a new test file in the appropriate directory
2. Import the API client and test config
3. Use describe/test blocks from Jest
4. Follow the existing patterns for consistency

Example:
```javascript
import { describe, test, expect } from '@jest/globals';
import APIClient from '../helpers/api-client.js';

describe('Feature Name', () => {
  let client;

  beforeAll(() => {
    client = new APIClient();
  });

  test('should do something', async () => {
    const response = await client.get('/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Best Practices

- Each test should be independent and not rely on other tests
- Clean up any data created during tests
- Use descriptive test names
- Verify both success and error cases
- Check response structure and data types, not just status codes
- Use beforeAll/afterAll for setup and cleanup
- Keep tests focused on one behavior per test

## Test Coverage

The tests should cover:
- ✅ Authentication (login, signup, token validation)
- ⏳ Team management (create, join, approve, reject, remove)
- ⏳ Payment flows (checkout, webhook)
- ⏳ Content access (check access, get content)
- ⏳ Edge cases and error handling

## CI/CD Integration

These tests should be run:
- Before deploying major changes
- After deployment to verify everything works
- As part of CI/CD pipeline (recommended)

## Troubleshooting

**Test user creation fails**: The test user may already exist. This is OK - the tests will continue.

**Connection errors**: Check that the API_URL in `.env.test` is correct and the API is accessible.

**Authentication failures**: Verify the test user credentials are correct and the user exists in Cognito.
