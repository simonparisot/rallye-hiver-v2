import axios from 'axios';
import { config } from '../config/test-config.js';

/**
 * API client for functional tests
 */
class APIClient {
  constructor() {
    this.baseURL = config.apiUrl;
    this.tokens = null;
  }

  /**
   * Make a request to the API
   */
  async request(method, endpoint, data = null, headers = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const axiosConfig = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      axiosConfig.data = data;
    }

    // Add authorization header if tokens are available
    if (this.tokens && this.tokens.accessToken) {
      axiosConfig.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
    }

    try {
      const response = await axios(axiosConfig);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
          error: true,
        };
      }
      throw error;
    }
  }

  /**
   * POST request
   */
  async post(endpoint, data, headers = {}) {
    return this.request('POST', endpoint, data, headers);
  }

  /**
   * GET request
   */
  async get(endpoint, headers = {}) {
    return this.request('GET', endpoint, null, headers);
  }

  /**
   * DELETE request
   */
  async delete(endpoint, headers = {}) {
    return this.request('DELETE', endpoint, null, headers);
  }

  /**
   * Set authentication tokens
   */
  setTokens(tokens) {
    this.tokens = tokens;
  }

  /**
   * Clear authentication tokens
   */
  clearTokens() {
    this.tokens = null;
  }

  /**
   * Get current tokens
   */
  getTokens() {
    return this.tokens;
  }
}

export default APIClient;
