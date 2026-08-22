import axios from 'axios';
import { config } from '../config/test-config.js';

/**
 * Client HTTP des tests fonctionnels.
 *
 * Une instance représente un acteur (visiteur anonyme, chef d'équipe, membre,
 * administrateur). Les scénarios à plusieurs acteurs instancient un client par
 * personne plutôt que de jongler avec des jetons sur un client partagé.
 */
class APIClient {
  constructor({ label = 'anonymous' } = {}) {
    this.baseURL = config.apiUrl;
    this.label = label;
    this.tokens = null;
    this.user = null;
  }

  async request(method, endpoint, data = null, headers = {}) {
    const axiosConfig = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: { 'Content-Type': 'application/json', ...headers },
      // On veut inspecter les réponses d'erreur, pas lever une exception dessus.
      validateStatus: () => true,
    };

    if (data !== null) axiosConfig.data = data;
    if (this.tokens?.accessToken) {
      axiosConfig.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
    }

    const response = await axios(axiosConfig);

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      ok: response.status >= 200 && response.status < 300,
      error: response.status >= 400,
    };
  }

  get(endpoint, headers) { return this.request('GET', endpoint, null, headers); }
  post(endpoint, data, headers) { return this.request('POST', endpoint, data, headers); }
  put(endpoint, data, headers) { return this.request('PUT', endpoint, data, headers); }
  delete(endpoint, headers) { return this.request('DELETE', endpoint, null, headers); }

  /** Authentifie ce client et mémorise ses jetons. */
  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });

    if (!response.ok) {
      throw new Error(
        `Connexion impossible pour ${email} (HTTP ${response.status}) : ` +
        JSON.stringify(response.data)
      );
    }

    this.tokens = {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      idToken: response.data.idToken,
    };
    this.user = response.data.user;

    return response.data;
  }

  setTokens(tokens) { this.tokens = tokens; }
  getTokens() { return this.tokens; }
  clearTokens() { this.tokens = null; this.user = null; }
}

export default APIClient;
