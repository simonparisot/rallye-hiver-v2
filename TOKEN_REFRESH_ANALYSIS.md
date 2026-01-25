# Analyse: Mécanisme de Refresh Token

Date: 2025-12-21

## ❌ Problème Identifié : PAS DE REFRESH TOKEN AUTOMATIQUE

### Résumé Exécutif

**Le frontend NE gère PAS le refresh automatique des tokens.**

Les utilisateurs devront se reconnecter manuellement lorsque leur access token expire (généralement après 1 heure avec Cognito).

---

## 🔍 État Actuel

### Backend (AWS Cognito)

✅ **Configuré correctement** :
```yaml
# serverless.yml:985-994
ExplicitAuthFlows:
  - ALLOW_REFRESH_TOKEN_AUTH  # ✅ Activé
RefreshTokenValidity: 90      # ✅ 90 jours
TokenValidityUnits:
  RefreshToken: days
```

✅ **Tokens retournés au login** :
```typescript
// backend/src/functions/auth/login.ts:42
{
  accessToken: tokens.accessToken,   // ✅ Valide ~1h
  refreshToken: tokens.refreshToken, // ✅ Valide 90 jours
  idToken: tokens.idToken
}
```

❌ **Pas d'endpoint `/auth/refresh`** :
- Aucun endpoint backend pour utiliser le refresh token
- Le frontend ne peut pas appeler Cognito directement

---

### Frontend

✅ **Tokens stockés** :
```typescript
// AuthContext.tsx:64-66
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken); // ✅ Stocké
localStorage.setItem('idToken', response.idToken);
```

❌ **Mais jamais utilisé** :
```typescript
// api.ts:28-34 - Seulement l'accessToken est utilisé
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ❌ PAS d'interceptor response pour gérer les 401
// ❌ PAS de logique pour refresh avant expiration
// ❌ PAS d'appel à un endpoint /auth/refresh
```

---

## 🚨 Impact Utilisateur

### Scénario actuel :

1. **T=0** : Utilisateur se connecte
   - Access token valide pour ~1h
   - Refresh token valide pour 90 jours

2. **T=1h** : Access token expire
   - ❌ Toutes les requêtes API retournent 401 Unauthorized
   - ❌ Aucune tentative de refresh automatique
   - ❌ L'utilisateur voit des erreurs

3. **Résultat** :
   - 😡 Utilisateur doit se reconnecter manuellement TOUTES LES HEURES
   - 😡 Perte de contexte (navigation, formulaires en cours)
   - 😡 Expérience utilisateur dégradée

---

## 🎯 Solution Recommandée

### Approche 1 : Refresh via Backend (Recommandé)

#### Étape 1 : Créer endpoint backend `/auth/refresh`

**Fichier** : `backend/src/functions/auth/refresh.ts`
```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { refreshToken } = JSON.parse(event.body || '{}');

    if (!refreshToken) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Refresh token required' }),
      };
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const result = await cognito.send(command);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        accessToken: result.AuthenticationResult?.AccessToken,
        idToken: result.AuthenticationResult?.IdToken,
        // Note: Cognito may or may not return a new refresh token
        refreshToken: result.AuthenticationResult?.RefreshToken,
      }),
    };
  } catch (error: any) {
    console.error('Token refresh error:', error);

    return {
      statusCode: 401,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Invalid or expired refresh token',
        message: error.message
      }),
    };
  }
};
```

**Ajouter dans** `serverless.yml`:
```yaml
  refreshToken:
    handler: src/functions/auth/refresh.handler
    events:
      - http:
          path: /auth/refresh
          method: post
          cors: true
```

#### Étape 2 : Ajouter endpoint dans frontend API

**Fichier** : `frontend/src/services/api.ts`
```typescript
// Dans authAPI:
export const authAPI = {
  // ... existing methods

  refresh: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },
};
```

#### Étape 3 : Implémenter interceptor response dans frontend

**Fichier** : `frontend/src/services/api.ts`
```typescript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ NEW: Response interceptor - Handle 401 and refresh token
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }).catch(err => {
        return Promise.reject(err);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      // No refresh token - logout user
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      window.location.href = '/'; // Redirect to login
      return Promise.reject(error);
    }

    try {
      // Call refresh endpoint
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, idToken, refreshToken: newRefreshToken } = response.data;

      // Update tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('idToken', idToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }

      // Update authorization header
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      // Process queued requests
      processQueue(null, accessToken);

      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed - logout user
      processQueue(refreshError, null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      window.location.href = '/'; // Redirect to login
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export { api };
// ... rest of API exports
```

#### Étape 4 : Refresh proactif (Optionnel mais recommandé)

Rafraîchir le token **avant** qu'il n'expire au lieu d'attendre une erreur 401.

**Fichier** : `frontend/src/contexts/AuthContext.tsx`
```typescript
import { jwtDecode } from 'jwt-decode';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // ✅ NEW: Auto-refresh timer
  useEffect(() => {
    if (!user) return;

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    try {
      const decoded: any = jwtDecode(accessToken);
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh 5 minutes before expiry
      const refreshTime = timeUntilExpiry - (5 * 60 * 1000);

      if (refreshTime > 0) {
        const timer = setTimeout(async () => {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const response = await authAPI.refresh(refreshToken);
              localStorage.setItem('accessToken', response.accessToken);
              localStorage.setItem('idToken', response.idToken);
              if (response.refreshToken) {
                localStorage.setItem('refreshToken', response.refreshToken);
              }
            } catch (error) {
              console.error('Failed to refresh token:', error);
              logout();
            }
          }
        }, refreshTime);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }
  }, [user]);

  // ... rest of AuthProvider
};
```

**Installer** :
```bash
npm install jwt-decode
```

---

### Approche 2 : Refresh Direct via Cognito (Plus Complexe)

Le frontend pourrait appeler Cognito directement avec AWS SDK, mais :
- ❌ Plus complexe à gérer
- ❌ Expose les credentials Cognito côté client
- ❌ Pas de contrôle backend
- ❌ Non recommandé

---

## 📊 Comparaison Avant/Après

| Aspect | Avant (Actuel) | Après (Avec Refresh) |
|--------|---------------|---------------------|
| **Durée session** | ~1 heure | 90 jours |
| **Reconnexions** | Toutes les heures | Jamais (sauf logout) |
| **Expérience UX** | ❌ Dégradée | ✅ Fluide |
| **Sécurité** | ⚠️ Acceptable | ✅ Meilleure |
| **Complexité** | Simple | Moyenne |

---

## 🚀 Plan d'Implémentation

### Phase 1 : Backend (1h)
1. ✅ Créer `backend/src/functions/auth/refresh.ts`
2. ✅ Ajouter endpoint dans `serverless.yml`
3. ✅ Déployer backend
4. ✅ Tester avec curl/Postman

### Phase 2 : Frontend - Interceptor (1h)
5. ✅ Ajouter response interceptor dans `api.ts`
6. ✅ Gérer la queue de requêtes pendant refresh
7. ✅ Tester le flow 401 → refresh → retry

### Phase 3 : Frontend - Refresh Proactif (30min, Optionnel)
8. ✅ Installer `jwt-decode`
9. ✅ Ajouter timer dans AuthContext
10. ✅ Tester refresh automatique avant expiration

### Phase 4 : Tests (1h)
11. ✅ Tester expiration naturelle du token
12. ✅ Tester refresh token invalide
13. ✅ Tester refresh token expiré (après 90j)
14. ✅ Tester requêtes concurrentes pendant refresh

**Temps total estimé** : 3-4 heures

---

## 🧪 Comment Tester

### Test 1 : Expiration Naturelle
```bash
# 1. Se connecter
# 2. Attendre 1h (ou modifier la durée du token en dev)
# 3. Faire une requête API
# 4. Vérifier que le token est rafraîchi automatiquement
```

### Test 2 : Token Expiré Manuellement
```javascript
// Dans la console du navigateur:
localStorage.setItem('accessToken', 'invalid_token');
// Faire une requête → devrait refresh automatiquement
```

### Test 3 : Refresh Token Invalide
```javascript
localStorage.setItem('refreshToken', 'invalid_refresh_token');
// Faire une requête → devrait logout et rediriger
```

---

## 📝 Notes Supplémentaires

### Sécurité
- ✅ Refresh tokens stockés en localStorage (acceptable pour SPA)
- ⚠️ Pour une sécurité maximale, utiliser httpOnly cookies (mais plus complexe)
- ✅ Refresh tokens ont une durée limitée (90 jours)

### Cognito Refresh Token Rotation
Cognito peut être configuré pour faire du "token rotation" :
- Chaque refresh retourne un NOUVEAU refresh token
- L'ancien refresh token est invalidé
- Améliore la sécurité (détecte les tokens volés)

**Recommandation** : Activer dans Cognito :
```yaml
# serverless.yml
TokenGenerationConfiguration:
  RefreshTokenRotation: Enabled
```

### Monitoring
Ajouter des logs pour surveiller :
- Nombre de refresh par utilisateur/jour
- Taux d'échec de refresh
- Refresh tokens expirés

---

## ✅ Checklist d'Implémentation

- [ ] Créer endpoint backend `/auth/refresh`
- [ ] Ajouter dans serverless.yml
- [ ] Déployer backend
- [ ] Ajouter méthode `authAPI.refresh()` frontend
- [ ] Implémenter response interceptor
- [ ] Gérer la queue de requêtes
- [ ] Tester flow 401 → refresh → retry
- [ ] (Optionnel) Ajouter refresh proactif
- [ ] (Optionnel) Activer token rotation Cognito
- [ ] Tester tous les scénarios
- [ ] Monitorer en production

---

## 🔗 Ressources

- [AWS Cognito Refresh Token Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
- [Axios Interceptors Guide](https://axios-http.com/docs/interceptors)
- [JWT Decode Library](https://www.npmjs.com/package/jwt-decode)
