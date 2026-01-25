## Spécification : Calcul de difficulté des énigmes

### 1. Objectif

Calculer un score de difficulté (0-10) pour chaque énigme du rallye d'hiver, basé sur les comportements observés des équipes participantes.

---

### 2. Données d'entrée

Pour chaque énigme `e` :

| Variable | Type | Description |
|----------|------|-------------|
| `tentatives` | int | Nombre total de mots de passe testés |
| `resolutions` | int | Nombre d'équipes ayant trouvé la solution |
| `equipes_actives` | int | Nombre d'équipes ayant testé au moins 1 mot de passe sur cette énigme |
| `equipes_totales` | int | Nombre total d'équipes inscrites au rallye |
| `temps_moyen_resolution` | float | Temps moyen (en jours) entre première tentative et résolution, pour les équipes ayant résolu |
| `duree_rallye` | int | Durée totale du rallye en jours (constante = 90) |

---

### 3. Indicateurs normalisés

#### 3.1 Intensité de recherche (I)

Mesure l'effort de tâtonnement nécessaire.

```
Si resolutions = 0 :
    I = 10
Sinon :
    ratio = tentatives / resolutions
    I = min(10, log₂(ratio))
    I = max(0, I)  // sécurité
```

#### 3.2 Taux d'échec (E)

Mesure la proportion d'équipes n'ayant pas résolu.

```
E = 10 × (1 - resolutions / equipes_totales)
```

#### 3.3 Temps relatif (T)

Mesure la latence avant résolution.

```
Si resolutions = 0 :
    T = 10
Sinon :
    T = min(10, 10 × (temps_moyen_resolution / duree_rallye))
```

#### 3.4 Taux d'abandon (A)

Mesure la proportion d'équipes ayant essayé mais renoncé.

```
Si equipes_actives = 0 :
    A = 0
Sinon :
    A = 10 × (1 - resolutions / equipes_actives)
```

Note : A diffère de E car il ne considère que les équipes ayant tenté l'énigme.

---

### 4. Score de difficulté

```
Difficulté = (α × I) + (β × E) + (γ × T) + (δ × A)
```

**Pondérations par défaut :**

| Coefficient | Valeur | Justification |
|-------------|--------|---------------|
| α | 0.25 | Effort de recherche |
| β | 0.45 | Taux d'échec global — le plus discriminant |
| γ | 0.20 | Temps de résolution |
| δ | 0.10 | Abandon — signal faible mais utile |

Les coefficients sont paramétrables et doivent respecter : `α + β + γ + δ = 1`

---

### 5. Cas limites

| Situation | Traitement |
|-----------|------------|
| Aucune tentative sur l'énigme | Difficulté = `null` (non calculable) |
| Aucune résolution | I = 10, T = 10, A = 10 |
| Une seule résolution | Calcul normal, temps_moyen = temps de cette équipe |
| Résolution sans tentative préalable enregistrée | Exclure du calcul ou considérer tentatives = 1 |