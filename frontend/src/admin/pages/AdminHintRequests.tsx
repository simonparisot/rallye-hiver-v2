import React, { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminHintsAPI, adminEnigmasAPI, adminTeamsAPI } from '../services/adminAPI';
import './AdminHintRequests.css';

/**
 * Journal des demandes d'indices.
 *
 * C'est l'outil avec lequel l'organisateur juge si l'essai est concluant :
 * il doit pouvoir lire, sans troncature, ce que l'équipe a écrit et ce qui lui
 * a été répondu, et croiser cela par énigme et par équipe.
 */
const AdminHintRequests: React.FC = () => {
  const [filtreEnigme, setFiltreEnigme] = useState('');
  const [filtreEquipe, setFiltreEquipe] = useState('');
  const [tri, setTri] = useState<'asc' | 'desc'>('desc');
  const [curseur, setCurseur] = useState<string | null>(null);
  const [deplie, setDeplie] = useState<Set<string>>(new Set());

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['adminHintRequests', filtreEnigme, filtreEquipe, tri, curseur],
    queryFn: () =>
      adminHintsAPI.getRequests({
        enigmaId: filtreEnigme || undefined,
        teamId: filtreEquipe || undefined,
        sort: tri,
        limit: 50,
        cursor: curseur,
      }),
    placeholderData: keepPreviousData,
  });

  // Listes de référence pour les filtres : les demandes seules ne suffisent pas,
  // une énigme sans demande doit rester sélectionnable.
  const { data: enigmesData } = useQuery({
    queryKey: ['adminEnigmas'],
    queryFn: adminEnigmasAPI.listAll,
  });
  const { data: equipesData } = useQuery({
    queryKey: ['adminTeams'],
    queryFn: adminTeamsAPI.listAll,
  });

  const enigmes = useMemo(
    () => [...(enigmesData?.enigmas || [])].sort((a, b) => a.enigmaNumber - b.enigmaNumber),
    [enigmesData]
  );
  const equipes = useMemo(
    () => [...(equipesData?.teams || [])].sort((a: any, b: any) =>
      String(a.teamName || '').localeCompare(String(b.teamName || ''))
    ),
    [equipesData]
  );

  const changerFiltre = (action: () => void) => {
    action();
    setCurseur(null); // repartir de la première page à chaque changement de filtre
  };

  const basculer = (id: string) => {
    setDeplie((courant) => {
      const suivant = new Set(courant);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  };

  if (isLoading) {
    return (
      <div data-testid="admin-hints-loading" className="loading">
        Chargement du journal des indices...
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="admin-hints-error" className="error">
        Erreur lors du chargement du journal des indices
      </div>
    );
  }

  const demandes = data?.requests || [];
  const stats = data?.stats;

  return (
    <div data-testid="admin-hints-page" className="admin-hint-requests">
      <div className="admin-page-header">
        <div>
          <h1>Journal des indices</h1>
          <p className="admin-page-subtitle">
            Chaque demande d'indice : ce que l'équipe a décrit, l'indice choisi, la date et les
            points facturés.
          </p>
        </div>
      </div>

      {stats && (
        <div className="hint-stats card">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value" data-testid="admin-hints-stat-total">
                {stats.totalRequests}
              </div>
              <div className="stat-label">Demandes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.uniqueTeams}</div>
              <div className="stat-label">Équipes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.uniqueEnigmas}</div>
              <div className="stat-label">Énigmes concernées</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.totalPointsCharged}</div>
              <div className="stat-label">Points facturés</div>
            </div>
          </div>
        </div>
      )}

      <div className="hint-filters card" data-testid="admin-hints-filters">
        <div className="hint-filter">
          <label htmlFor="filtre-enigme">Énigme</label>
          <select
            id="filtre-enigme"
            data-testid="admin-hints-filter-enigma"
            value={filtreEnigme}
            onChange={(e) => changerFiltre(() => setFiltreEnigme(e.target.value))}
          >
            <option value="">Toutes les énigmes</option>
            {enigmes.map((e) => (
              <option key={e.enigmaId} value={e.enigmaId}>
                #{e.enigmaNumber} {e.title}
              </option>
            ))}
          </select>
        </div>

        <div className="hint-filter">
          <label htmlFor="filtre-equipe">Équipe</label>
          <select
            id="filtre-equipe"
            data-testid="admin-hints-filter-team"
            value={filtreEquipe}
            onChange={(e) => changerFiltre(() => setFiltreEquipe(e.target.value))}
          >
            <option value="">Toutes les équipes</option>
            {equipes.map((t: any) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>

        <div className="hint-filter">
          <label htmlFor="filtre-tri">Tri par date</label>
          <select
            id="filtre-tri"
            data-testid="admin-hints-sort"
            value={tri}
            onChange={(e) => changerFiltre(() => setTri(e.target.value as 'asc' | 'desc'))}
          >
            <option value="desc">Plus récentes d'abord</option>
            <option value="asc">Plus anciennes d'abord</option>
          </select>
        </div>

        {(filtreEnigme || filtreEquipe) && (
          <button
            type="button"
            className="btn btn-small btn-secondary"
            data-testid="admin-hints-filter-reset"
            onClick={() =>
              changerFiltre(() => {
                setFiltreEnigme('');
                setFiltreEquipe('');
              })
            }
          >
            Tout afficher
          </button>
        )}

        <span className="hint-filter-count" data-testid="admin-hints-result-count">
          {data?.total ?? 0} demande{(data?.total ?? 0) > 1 ? 's' : ''} dans la sélection
          {isFetching ? ' (mise à jour...)' : ''}
        </span>
      </div>

      {demandes.length === 0 ? (
        <div data-testid="admin-hints-empty" className="empty-state">
          <p>Aucune demande d'indice pour cette sélection.</p>
        </div>
      ) : (
        <div className="hint-request-list" data-testid="admin-hints-list">
          {demandes.map((d) => {
            const ouvert = deplie.has(d.requestId);
            return (
              <article
                className="hint-request card"
                key={d.requestId}
                data-testid={`admin-hints-row-${d.requestId}`}
              >
                <header className="hint-request-head">
                  <div className="hint-request-who">
                    <span className="hint-request-team">{d.teamName}</span>
                    <span className="hint-request-enigma">
                      #{d.enigmaNumber} {d.enigmaTitle}
                    </span>
                  </div>
                  <div className="hint-request-meta">
                    <span className="hint-request-date">
                      {new Date(d.requestedAt).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </span>
                    <span className="hint-request-cost">
                      {d.pointsCharged > 0 ? `-${d.pointsCharged} points` : 'sans coût'}
                    </span>
                  </div>
                </header>

                <section className="hint-request-block">
                  <h3>Avancement décrit par l'équipe</h3>
                  <p className="hint-request-progress">{d.progressText}</p>
                </section>

                <section className="hint-request-block">
                  <h3>
                    Indice livré <span className="hint-request-id">({d.hintId})</span>
                  </h3>
                  <p className="hint-request-hint">{d.hintText}</p>
                </section>

                <footer className="hint-request-foot">
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    data-testid={`admin-hints-toggle-${d.requestId}`}
                    onClick={() => basculer(d.requestId)}
                  >
                    {ouvert ? 'Masquer le détail technique' : 'Détail technique'}
                  </button>
                  {ouvert && (
                    <div
                      className="hint-request-tech"
                      data-testid={`admin-hints-tech-${d.requestId}`}
                    >
                      {d.justification && (
                        <p>
                          <strong>Justification interne :</strong> {d.justification}
                        </p>
                      )}
                      <p>
                        <strong>Modèle :</strong> {d.model}
                        {d.inputTokens !== undefined && (
                          <>
                            {' '}
                            · <strong>Jetons :</strong> {d.inputTokens} entrée
                            {d.outputTokens !== undefined ? ` / ${d.outputTokens} sortie` : ''}
                          </>
                        )}
                      </p>
                      <p className="hint-request-ids">
                        demande {d.requestId} · équipe {d.teamId} · énigme {d.enigmaId}
                      </p>
                    </div>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {(curseur || data?.cursor) && (
        <div className="hint-pagination" data-testid="admin-hints-pagination">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="admin-hints-first-page"
            onClick={() => setCurseur(null)}
            disabled={!curseur}
          >
            Première page
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="admin-hints-next-page"
            onClick={() => setCurseur(data?.cursor || null)}
            disabled={!data?.cursor}
          >
            Page suivante
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminHintRequests;
