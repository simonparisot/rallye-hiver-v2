import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminWrongPasswordMessagesAPI,
  WrongPasswordMessagesSettings,
} from '../services/adminAPI';
import './AdminWrongPasswordMessages.css';

/**
 * Messages de mauvais mot de passe.
 *
 * Quand une équipe se trompe de mot de passe, le serveur lui répond par un de
 * ces messages, tiré au hasard. L'orga édite la liste ici ; sans liste
 * enregistrée, ce sont les messages par défaut qui servent.
 */

const QUERY_KEY = ['adminWrongPasswordMessages'];

function messageErreur(err: any, repli: string): string {
  return err?.response?.data?.error || err?.message || repli;
}

const AdminWrongPasswordMessages: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminWrongPasswordMessagesAPI.get,
    refetchOnWindowFocus: false, // ne pas écraser un brouillon en cours
  });

  const [brouillon, setBrouillon] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Le brouillon repart de la version serveur à chaque chargement ou enregistrement.
  useEffect(() => {
    if (data) setBrouillon(data.messages);
  }, [data]);

  const maxMessages = data?.limits.maxMessages ?? 100;
  const maxLength = data?.limits.maxLength ?? 300;

  const modifie = useMemo(
    () => !!data && JSON.stringify(brouillon) !== JSON.stringify(data.messages),
    [brouillon, data]
  );

  // Contrôle côté client, le même que le serveur, pour signaler tôt.
  const probleme = useMemo(() => {
    const nonVides = brouillon.map((m) => m.trim()).filter(Boolean);
    if (nonVides.length === 0) return 'Il faut au moins un message.';
    const vide = brouillon.findIndex((m) => !m.trim());
    if (vide >= 0) return `Le message n°${vide + 1} est vide : remplissez-le ou supprimez-le.`;
    const long = brouillon.findIndex((m) => m.trim().length > maxLength);
    if (long >= 0) return `Le message n°${long + 1} dépasse ${maxLength} caractères.`;
    if (new Set(nonVides).size > maxMessages) return `Au plus ${maxMessages} messages.`;
    return null;
  }, [brouillon, maxLength, maxMessages]);

  const appliquer = (resultat: WrongPasswordMessagesSettings, texte: string) => {
    queryClient.setQueryData(QUERY_KEY, resultat);
    setBrouillon(resultat.messages);
    setInfo(texte);
  };

  const changer = (index: number, valeur: string) => {
    setInfo(null);
    setBrouillon((courant) => courant.map((m, i) => (i === index ? valeur : m)));
  };

  const supprimer = (index: number) => {
    setInfo(null);
    setBrouillon((courant) => courant.filter((_, i) => i !== index));
  };

  const deplacer = (index: number, sens: -1 | 1) => {
    setInfo(null);
    setBrouillon((courant) => {
      const cible = index + sens;
      if (cible < 0 || cible >= courant.length) return courant;
      const suivant = [...courant];
      [suivant[index], suivant[cible]] = [suivant[cible], suivant[index]];
      return suivant;
    });
  };

  const ajouter = () => {
    setInfo(null);
    setBrouillon((courant) => [...courant, '']);
  };

  const enregistrer = async () => {
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      const resultat = await adminWrongPasswordMessagesAPI.save(brouillon);
      appliquer(resultat, `${resultat.messages.length} message(s) enregistré(s).`);
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'enregistrer les messages."));
    } finally {
      setEnCours(false);
    }
  };

  const revenirAuxDefauts = async () => {
    if (!window.confirm(
      'Revenir aux messages par défaut ? La liste personnalisée sera supprimée.'
    )) {
      return;
    }
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      const resultat = await adminWrongPasswordMessagesAPI.reset();
      appliquer(resultat, 'Messages par défaut rétablis.');
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de rétablir les messages par défaut.'));
    } finally {
      setEnCours(false);
    }
  };

  if (isLoading) {
    return (
      <div data-testid="admin-wrong-password-loading" className="loading">
        Chargement des messages...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div data-testid="admin-wrong-password-error" className="error">
        {messageErreur(error, 'Erreur lors du chargement des messages')}
      </div>
    );
  }

  return (
    <div data-testid="admin-wrong-password-page" className="admin-wrong-password">
      <div className="admin-page-header">
        <div>
          <h1>Messages de mauvais mot de passe</h1>
          <p className="admin-page-subtitle">
            Quand une équipe donne un mauvais mot de passe, elle reçoit un de ces messages,
            tiré au hasard à chaque tentative.
          </p>
        </div>
      </div>

      <div className="card">
        <p className="admin-form-note wpm-status" data-testid="admin-wrong-password-status">
          {data.isDefault
            ? 'Ce sont les messages par défaut : aucune liste personnalisée n’est enregistrée.'
            : `Liste personnalisée${data.updatedAt
                ? `, enregistrée le ${new Date(data.updatedAt).toLocaleString('fr-FR')}`
                : ''}.`}
          {' '}Entre 1 et {maxMessages} messages, {maxLength} caractères au plus chacun ;
          les doublons sont retirés à l'enregistrement.
        </p>

        <ol className="wpm-list" data-testid="admin-wrong-password-list">
          {brouillon.map((message, index) => {
            const longueur = message.trim().length;
            const tropLong = longueur > maxLength;
            return (
              <li key={index} className="wpm-item" data-testid="admin-wrong-password-item">
                <span className="wpm-number">{index + 1}</span>
                <div className="wpm-field">
                  <textarea
                    className={`admin-input wpm-textarea ${!message.trim() || tropLong ? 'wpm-invalid' : ''}`}
                    value={message}
                    rows={2}
                    aria-label={`Message ${index + 1}`}
                    data-testid={`admin-wrong-password-input-${index}`}
                    onChange={(e) => changer(index, e.target.value)}
                  />
                  <span className={`admin-form-help ${tropLong ? 'admin-text-error' : ''}`}>
                    {longueur} / {maxLength}
                  </span>
                </div>
                <div className="wpm-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => deplacer(index, -1)}
                    disabled={index === 0 || enCours}
                    aria-label={`Monter le message ${index + 1}`}
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => deplacer(index, 1)}
                    disabled={index === brouillon.length - 1 || enCours}
                    aria-label={`Descendre le message ${index + 1}`}
                    title="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => supprimer(index)}
                    disabled={enCours}
                    data-testid={`admin-wrong-password-remove-${index}`}
                    aria-label={`Supprimer le message ${index + 1}`}
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={ajouter}
          disabled={enCours || brouillon.length >= maxMessages}
          data-testid="admin-wrong-password-add"
        >
          + Ajouter un message
        </button>

        {probleme && modifie && (
          <div className="admin-form-error" data-testid="admin-wrong-password-problem">
            {probleme}
          </div>
        )}
        {erreur && (
          <div className="admin-form-error" role="alert" data-testid="admin-wrong-password-server-error">
            {erreur}
          </div>
        )}
        {info && !modifie && (
          <p className="admin-text-success admin-mt-md" data-testid="admin-wrong-password-info">
            {info}
          </p>
        )}

        <div className="admin-form-actions wpm-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={enregistrer}
            disabled={enCours || !modifie || !!probleme}
            data-testid="admin-wrong-password-save"
          >
            {enCours ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {modifie && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setBrouillon(data.messages); setErreur(null); }}
              disabled={enCours}
            >
              Annuler les modifications
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary wpm-reset"
            onClick={revenirAuxDefauts}
            disabled={enCours || data.isDefault}
            data-testid="admin-wrong-password-reset"
          >
            Revenir aux messages par défaut
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminWrongPasswordMessages;
