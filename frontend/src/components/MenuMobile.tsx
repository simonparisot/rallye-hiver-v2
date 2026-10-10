import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Enigma, Parcours } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './MenuMobile.css';

/**
 * La navigation du téléphone, rassemblée dans un tiroir.
 *
 * Sur petit écran, la page montrait une barre d'onglets, puis une liste
 * d'intrigues, puis l'énoncé de celle qu'on avait choisie : trois niveaux
 * empilés dans une colonne de 390 pixels, où lire un énoncé demandait de
 * faire défiler la liste entière. La liste quitte donc la page pour ce menu,
 * et l'écran principal ne porte plus que ce qu'on est venu lire.
 *
 * Le menu est un tiroir plein écran, avec des sections dépliables : Intrigues
 * et Tournées s'ouvrent sur leur liste complète, Ma troupe et le compte sont des
 * entrées simples. Ce qui est affiché à l'écran est marqué dans le menu.
 */

export type SectionCourante = 'enigmes' | 'parcours' | 'equipe';

interface MenuMobileProps {
  section: SectionCourante;
  /** Faux tant que l'équipe n'est pas rejointe et l'inscription réglée. */
  acces: boolean;
  enigmas: Enigma[];
  parcours: Parcours[];
  enigmeId: string | null;
  parcoursId: string | null;
  onChoisirEnigme: (enigma: Enigma) => void;
  onChoisirParcours: (parcours: Parcours) => void;
  onAllerTroupe: () => void;
  onMotDePasse: () => void;
}

const MenuMobile: React.FC<MenuMobileProps> = ({
  section, acces, enigmas, parcours, enigmeId, parcoursId,
  onChoisirEnigme, onChoisirParcours, onAllerTroupe, onMotDePasse,
}) => {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  // Tout est replié à l'ouverture. Déplier la section en cours mettait vingt
  // lignes sous les yeux avant qu'on ait rien demandé, et repoussait « Ma
  // troupe » et le compte hors de l'écran. C'est à qui ouvre le menu de dire
  // ce qu'il cherche.
  const [deplie, setDeplie] = useState<Record<string, boolean>>({});

  // Le tiroir prend tout l'écran : laisser la page défiler dessous donnerait
  // l'impression que le menu glisse.
  useEffect(() => {
    if (!ouvert) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('keydown', auClavier);
    return () => {
      document.body.style.overflow = avant;
      document.removeEventListener('keydown', auClavier);
    };
  }, [ouvert]);

  const basculer = (cle: string) => setDeplie((d) => ({ ...d, [cle]: !d[cle] }));

  const choisirEnigme = (e: Enigma) => { onChoisirEnigme(e); setOuvert(false); };
  const choisirParcours = (p: Parcours) => { onChoisirParcours(p); setOuvert(false); };

  const resolues = enigmas.filter((e) => e.isSolved).length;
  const realises = parcours.filter((p) => p.isCompleted).length;

  const Chevron = ({ ouvert: o }: { ouvert: boolean }) => (
    <svg className={`menu-chevron ${o ? 'menu-chevron-ouvert' : ''}`} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        className="menu-burger"
        data-testid="menu-burger"
        aria-label="Menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert(true)}
      >
        <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      </button>

      {/* Le tiroir est rendu dans le corps du document, pas dans l'en-tête :
          .barre porte un backdrop-filter, qui fait d'elle le bloc conteneur de
          ses descendants en position fixed. Le tiroir s'y retrouvait enfermé
          dans les soixante pixels de la barre. */}
      {ouvert && createPortal(
        <div className="menu-voile" onClick={(e) => { if (e.target === e.currentTarget) setOuvert(false); }}>
          <nav className="menu-tiroir" data-testid="menu-tiroir" aria-label="Navigation">
            <header className="menu-tete">
              <span className="menu-titre">Navigation</span>
              <button type="button" className="menu-fermer" onClick={() => setOuvert(false)} aria-label="Fermer le menu">×</button>
            </header>

            <div className="menu-corps">
              {/* --- Intrigues --- */}
              <section className="menu-section">
                <button
                  type="button"
                  className={`menu-entete ${section === 'enigmes' ? 'menu-entete-actif' : ''} ${!acces ? 'menu-entete-verrouille' : ''}`}
                  aria-expanded={acces && !!deplie.enigmes}
                  data-testid="menu-section-enigmes"
                  disabled={!acces}
                  onClick={() => basculer('enigmes')}
                >
                  <span className="menu-entete-titre">Intrigues</span>
                  {acces
                    ? <span className="menu-compte">{resolues}/{enigmas.length}</span>
                    : <span className="menu-compte">Troupe requise</span>}
                  <Chevron ouvert={!!deplie.enigmes} />
                </button>
                {acces && deplie.enigmes && (
                  <ul className="menu-liste">
                    {enigmas.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className={`menu-ligne ${e.isSolved ? 'menu-ligne-faite' : ''}`}
                          aria-current={section === 'enigmes' && e.id === enigmeId}
                          onClick={() => choisirEnigme(e)}
                        >
                          <span className={`menu-numero ${e.isSolved ? '' : 'menu-numero-a-faire'}`}>{e.order}</span>
                          <span className="menu-libelle">{e.title}</span>
                          {e.isSolved && <span className="menu-coche" aria-label="résolue">✓</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* --- Tournées --- */}
              <section className="menu-section">
                <button
                  type="button"
                  className={`menu-entete ${section === 'parcours' ? 'menu-entete-actif' : ''} ${!acces ? 'menu-entete-verrouille' : ''}`}
                  aria-expanded={acces && !!deplie.parcours}
                  data-testid="menu-section-parcours"
                  disabled={!acces}
                  onClick={() => basculer('parcours')}
                >
                  <span className="menu-entete-titre">Tournées</span>
                  {acces
                    ? <span className="menu-compte">{realises}/{parcours.length}</span>
                    : <span className="menu-compte">Troupe requise</span>}
                  <Chevron ouvert={!!deplie.parcours} />
                </button>
                {acces && deplie.parcours && (
                  <ul className="menu-liste">
                    {parcours.map((p, i) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`menu-ligne ${p.isCompleted ? 'menu-ligne-faite' : ''}`}
                          aria-current={section === 'parcours' && p.id === parcoursId}
                          onClick={() => choisirParcours(p)}
                        >
                          <span className="menu-numero">{p.order || i + 1}</span>
                          <span className="menu-libelle">{p.title}</span>
                          {p.isCompleted && <span className="menu-coche" aria-label="réalisé">✓</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* --- Ma troupe --- */}
              <section className="menu-section">
                <button
                  type="button"
                  className={`menu-entete ${section === 'equipe' ? 'menu-entete-actif' : ''}`}
                  data-testid="menu-section-troupe"
                  onClick={() => { onAllerTroupe(); setOuvert(false); }}
                >
                  <span className="menu-entete-titre">Ma troupe</span>
                </button>
              </section>

              {/* --- Le compte --- */}
              <section className="menu-section menu-section-compte">
                <p className="menu-identite">
                  <span className="menu-nom">{user?.displayName}</span>
                  <span className="menu-mail">{user?.email}</span>
                </p>
                <button
                  type="button"
                  className="menu-entree"
                  data-testid="menu-mot-de-passe"
                  onClick={() => { setOuvert(false); onMotDePasse(); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Réinitialiser mon mot de passe
                </button>
                <button
                  type="button"
                  className="menu-entree menu-sortie"
                  data-testid="menu-deconnexion"
                  onClick={logout}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
                  </svg>
                  Se déconnecter
                </button>
              </section>
            </div>
          </nav>
        </div>,
        document.body
      )}
    </>
  );
};

export default MenuMobile;
