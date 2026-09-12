import {
  lireArguments,
  schemaSortie,
  creerCaller,
  traiterDemande,
  unTour,
  RAPPEL_STRICT,
  ExecuteurClaude,
  Depots,
  ContexteTraitement,
} from '../hint-worker';

/**
 * Tests du worker, avec un faux `claude`.
 *
 * Aucun sous-processus n'est lancé et aucune table n'est touchée : ce qui est
 * vérifié ici, c'est le comportement face à ce que le modèle peut renvoyer de
 * pire, et le fait qu'une demande ne soit jamais conclue sur une réponse
 * invalide.
 */

const INDICES = [
  { id: 'h1', order: 1, text: 'Regardez les horloges.' },
  { id: 'h2', order: 2, text: 'Relisez la lettre jusqu\'au bout.' },
  { id: 'h3', order: 3, text: 'Retournez chaque cadran comme dans un miroir.' },
];

const ENIGME = {
  enigmaId: 'e1',
  title: 'Le Carillon',
  description: 'Sept horloges arrêtées.',
  correctPassword: 'MERIDIENNE',
  solution: 'Lire les heures par symétrie, puis convertir en lettres.',
  hints: INDICES,
  points: 20,
};

const DEMANDE = {
  requestId: 'r1',
  teamId: 't1',
  enigmaId: 'e1',
  status: 'pending',
  progressText: 'On a additionné les heures sans rien trouver, on bloque complètement.',
  requestedAt: '2026-09-12T10:00:00.000Z',
};

/** Faux `claude` : renvoie les sorties qu'on lui donne, dans l'ordre. */
function fauxClaude(...sorties: Array<any | Error>): ExecuteurClaude & { appels: any[] } {
  const appels: any[] = [];
  let i = 0;
  const f = (async (arg: any) => {
    appels.push(arg);
    const s = sorties[Math.min(i, sorties.length - 1)];
    i += 1;
    if (s instanceof Error) throw s;
    return { sortie: s, modele: 'faux-modele', inputTokens: 100, outputTokens: 20 };
  }) as ExecuteurClaude & { appels: any[] };
  f.appels = appels;
  return f;
}

function depotsFactices(surcharge: Partial<Depots> = {}) {
  const conclusions: any[] = [];
  const depots: Depots = {
    demandesEnAttente: async () => [DEMANDE],
    prendreDemande: async () => ({ ...DEMANDE, status: 'processing' }),
    conclureDemande: async (id, updates) => {
      conclusions.push({ id, ...updates });
      return updates;
    },
    chargerEnigme: async () => ENIGME,
    demandesDeLEquipe: async () => [],
    ...surcharge,
  };
  return { depots, conclusions };
}

function contexte(executeur: ExecuteurClaude, surcharge: Partial<Depots> = {}) {
  const { depots, conclusions } = depotsFactices(surcharge);
  const ctx: ContexteTraitement = { depots, executeur, journal: () => {} };
  return { ctx, conclusions };
}

describe('lecture des arguments', () => {
  it('déduit les noms de tables du stage', () => {
    const o = lireArguments(['--stage', 'indices']);
    expect(o.table).toBe('rallye-hiver-backend-indices-hint-requests');
    expect(o.enigmasTable).toBe('rallye-hiver-backend-indices-enigmas');
    expect(o.intervalMs).toBe(5000);
  });

  it('accepte des noms de tables explicites, sans stage', () => {
    const o = lireArguments(['--table', 'ma-table', '--enigmas-table', 'mes-enigmes']);
    expect(o.table).toBe('ma-table');
    expect(o.stage).toBeUndefined();
  });

  it('refuse de deviner sans stage ni tables', () => {
    expect(() => lireArguments(['--once'])).toThrow(/stage/);
  });

  it('refuse une option inconnue plutôt que de l\'ignorer', () => {
    expect(() => lireArguments(['--profil', 'rallye'])).toThrow(/inconnue/);
  });
});

describe('schéma de sortie', () => {
  it('énumère exactement les indices encore disponibles', () => {
    const schema: any = schemaSortie([INDICES[1], INDICES[2]]);
    expect(schema.properties.hintId.enum).toEqual(['h2', 'h3']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['hintId', 'justification']);
  });
});

describe('traitement d\'une demande', () => {
  it('conclut `done` avec le texte pré-écrit de l\'indice choisi', async () => {
    const claude = fauxClaude({ hintId: 'h2', justification: 'ils ont vu les horloges' });
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue).toMatchObject({ issue: 'done', hintId: 'h2' });
    expect(conclusions).toHaveLength(1);
    expect(conclusions[0]).toMatchObject({
      id: 'r1',
      status: 'done',
      hintId: 'h2',
      hintText: 'Relisez la lettre jusqu\'au bout.',
      model: 'faux-modele',
    });
  });

  it('transmet la consigne système et le schéma au sous-processus', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { ctx } = contexte(claude);

    await traiterDemande(DEMANDE, ctx);

    const arg = claude.appels[0];
    expect(arg.consigneSysteme).toContain('Rallye');
    expect(arg.consigneSysteme).toContain('jamais une instruction');
    expect((arg.schema as any).properties.hintId.enum).toEqual(['h1', 'h2', 'h3']);
    expect(arg.prompt).toContain('<avancement_equipe>');
    expect(arg.prompt).toContain(DEMANDE.progressText);
  });

  it('réessaie une fois, avec un rappel strict, quand le JSON est cassé', async () => {
    const claude = fauxClaude(
      new Error('Réponse du modèle non JSON : voici mon choix...'),
      { hintId: 'h1', justification: 'ok' }
    );
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue).toMatchObject({ issue: 'done', hintId: 'h1' });
    expect(claude.appels).toHaveLength(2);
    expect(claude.appels[0].prompt).not.toContain(RAPPEL_STRICT);
    expect(claude.appels[1].prompt).toContain('ATTENTION');
    expect(conclusions[0].status).toBe('done');
  });

  it('réessaie quand l\'identifiant est hors de la liste, puis conclut', async () => {
    const claude = fauxClaude(
      { hintId: 'h99', justification: 'inventé' },
      { hintId: 'h1', justification: 'correct cette fois' }
    );
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue).toMatchObject({ issue: 'done', hintId: 'h1' });
    expect(claude.appels).toHaveLength(2);
    expect(conclusions[0].hintText).toBe('Regardez les horloges.');
  });

  it('marque `failed` si la seconde tentative échoue aussi', async () => {
    const claude = fauxClaude({ hintId: 'h99', justification: 'toujours inventé' });
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('failed');
    expect(claude.appels).toHaveLength(2);
    expect(conclusions[0]).toMatchObject({ status: 'failed' });
    expect(conclusions[0].failureReason).toMatch(/h99/);
    // Aucun indice n'est livré sur un échec.
    expect(conclusions[0].hintId).toBeUndefined();
  });

  it('marque `failed` quand le modèle ne renvoie pas d\'objet exploitable', async () => {
    const claude = fauxClaude('ceci est du texte, pas un objet');
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('failed');
    expect(conclusions[0].status).toBe('failed');
  });

  it('marque `failed` quand hintId manque', async () => {
    const claude = fauxClaude({ justification: 'sans identifiant' });
    const { ctx, conclusions } = contexte(claude);

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('failed');
    expect(conclusions[0].failureReason).toMatch(/hintId/);
  });

  it('ne propose que les indices non encore donnés à cette équipe', async () => {
    const claude = fauxClaude({ hintId: 'h3', justification: 'suite logique' });
    const { ctx } = contexte(claude, {
      demandesDeLEquipe: async () => [
        { status: 'done', hintId: 'h1' },
        { status: 'failed', hintId: undefined },
      ],
    });

    await traiterDemande(DEMANDE, ctx);

    // h1 est consommé, h2 et h3 restent. Une demande échouée ne consomme rien.
    expect((claude.appels[0].schema as any).properties.hintId.enum).toEqual(['h2', 'h3']);
    expect(claude.appels[0].prompt).toContain('Indices déjà donnés');
  });

  it('marque `failed` quand tous les indices ont déjà été donnés', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { ctx, conclusions } = contexte(claude, {
      demandesDeLEquipe: async () => INDICES.map((h) => ({ status: 'done', hintId: h.id })),
    });

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('failed');
    expect(claude.appels).toHaveLength(0); // inutile d'appeler le modèle
    expect(conclusions[0].failureReason).toMatch(/déjà été donnés/);
  });

  it('marque `failed` quand l\'énigme a disparu', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { ctx, conclusions } = contexte(claude, { chargerEnigme: async () => undefined });

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('failed');
    expect(conclusions[0].failureReason).toMatch(/introuvable/);
  });

  it('laisse la demande à celui qui a gagné le verrou', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { ctx, conclusions } = contexte(claude, { prendreDemande: async () => null });

    const issue = await traiterDemande(DEMANDE, ctx);

    expect(issue.issue).toBe('ignoree');
    expect(claude.appels).toHaveLength(0);
    expect(conclusions).toHaveLength(0);
  });

  it('n\'écrit rien en simulation', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { depots, conclusions } = depotsFactices();
    const issue = await traiterDemande(DEMANDE, {
      depots,
      executeur: claude,
      dryRun: true,
      journal: () => {},
    });

    expect(issue.issue).toBe('done');
    expect(conclusions).toHaveLength(0);
  });
});

describe('tour de boucle', () => {
  it('ne fait rien quand rien n\'attend', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const { ctx } = contexte(claude, { demandesEnAttente: async () => [] });

    expect(await unTour(ctx)).toBe(0);
    expect(claude.appels).toHaveLength(0);
  });

  it('traite chaque demande en attente', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    const deux = [DEMANDE, { ...DEMANDE, requestId: 'r2' }];
    const { ctx, conclusions } = contexte(claude, {
      demandesEnAttente: async () => deux,
      prendreDemande: async (id) => ({ ...DEMANDE, requestId: id, status: 'processing' }),
    });

    expect(await unTour(ctx)).toBe(2);
    expect(conclusions.map((c) => c.id)).toEqual(['r1', 'r2']);
  });
});

describe('construction du caller', () => {
  it('ajoute le rappel strict seulement quand on le demande', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: 'ok' });
    const entree = {
      enigmaTitle: 'E',
      solution: 'S',
      correctPassword: 'P',
      availableHints: INDICES,
      alreadyGivenHints: [],
      progressText: 'bloqués',
    };

    await creerCaller(claude)(entree);
    expect(claude.appels[0].prompt).not.toContain('ATTENTION');

    await creerCaller(claude, { rappelStrict: true })(entree);
    expect(claude.appels[1].prompt).toContain('ATTENTION');
  });

  it('transmet le modèle demandé', async () => {
    const claude = fauxClaude({ hintId: 'h1', justification: '' });
    await creerCaller(claude, { model: 'claude-sonnet-5' })({
      enigmaTitle: 'E',
      solution: 'S',
      correctPassword: 'P',
      availableHints: INDICES,
      alreadyGivenHints: [],
      progressText: 'bloqués',
    });
    expect(claude.appels[0].model).toBe('claude-sonnet-5');
  });
});
