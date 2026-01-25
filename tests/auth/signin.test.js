import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import APIClient from '../helpers/api-client.js';
import { config } from '../config/test-config.js';

describe('Authentication - Sign In', () => {
  let client;
  let testUserCreated = false;

  beforeAll(async () => {
    client = new APIClient();

    // Try to create a test user (will fail if already exists, which is fine)
    try {
      const signupResponse = await client.post('/auth/signup', {
        email: config.testUser.email,
        password: config.testUser.password,
        displayName: config.testUser.displayName,
      });

      if (signupResponse.status === 200 || signupResponse.status === 201) {
        testUserCreated = true;
        console.log('Test user created successfully');
        // Clear tokens after signup to test login independently
        client.clearTokens();
      }
    } catch (error) {
      console.log('Test user may already exist (this is OK)');
    }
  });

  afterAll(() => {
    // Clean up if needed
    client.clearTokens();
  });

  test('should successfully login with valid credentials', async () => {
    const response = await client.post('/auth/login', {
      email: config.testUser.email,
      password: config.testUser.password,
    });

    // Verify response status
    expect(response.status).toBe(200);
    expect(response.error).toBeUndefined();

    // Verify response structure
    expect(response.data).toHaveProperty('accessToken');
    expect(response.data).toHaveProperty('refreshToken');
    expect(response.data).toHaveProperty('idToken');
    expect(response.data).toHaveProperty('user');

    // Verify tokens are strings and not empty
    expect(typeof response.data.accessToken).toBe('string');
    expect(response.data.accessToken.length).toBeGreaterThan(0);
    expect(typeof response.data.refreshToken).toBe('string');
    expect(response.data.refreshToken.length).toBeGreaterThan(0);
    expect(typeof response.data.idToken).toBe('string');
    expect(response.data.idToken.length).toBeGreaterThan(0);

    // Verify user object
    expect(response.data.user).toHaveProperty('userId');
    expect(response.data.user).toHaveProperty('email');
    expect(response.data.user.email).toBe(config.testUser.email);

    // Store tokens for other tests
    client.setTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      idToken: response.data.idToken,
    });
  });

  test('should fail login with invalid email', async () => {
    const response = await client.post('/auth/login', {
      email: 'nonexistent@example.com',
      password: config.testUser.password,
    });

    // Should return 401 or 400 for invalid credentials
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
    expect(response.data).toHaveProperty('error');
  });

  test('should fail login with invalid password', async () => {
    const response = await client.post('/auth/login', {
      email: config.testUser.email,
      password: 'WrongPassword123',
    });

    // Should return 401 or 400 for invalid credentials
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
    expect(response.data).toHaveProperty('error');
  });

  test('should fail login with missing email', async () => {
    const response = await client.post('/auth/login', {
      password: config.testUser.password,
    });

    // Should return 400 for missing required field
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
  });

  test('should fail login with missing password', async () => {
    const response = await client.post('/auth/login', {
      email: config.testUser.email,
    });

    // Should return 400 for missing required field
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
  });

  test('should fail login with empty credentials', async () => {
    const response = await client.post('/auth/login', {
      email: '',
      password: '',
    });

    // Should return 400 for empty credentials
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.error).toBe(true);
  });

  test('should be able to access protected endpoint with valid token', async () => {
    // First login to get a token
    const loginResponse = await client.post('/auth/login', {
      email: config.testUser.email,
      password: config.testUser.password,
    });

    expect(loginResponse.status).toBe(200);
    client.setTokens({
      accessToken: loginResponse.data.accessToken,
      refreshToken: loginResponse.data.refreshToken,
      idToken: loginResponse.data.idToken,
    });

    // Now try to access a protected endpoint
    const meResponse = await client.get('/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.error).toBeUndefined();
    expect(meResponse.data).toHaveProperty('userId');
    expect(meResponse.data).toHaveProperty('email');
    expect(meResponse.data.email).toBe(config.testUser.email);
  });

  test('should fail to access protected endpoint without token', async () => {
    // Clear tokens
    client.clearTokens();

    const response = await client.get('/auth/me');

    // Should return 401 or 403 for unauthorized access
    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.error).toBe(true);
  });
});
