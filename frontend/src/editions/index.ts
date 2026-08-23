import { Edition } from './types';
import { edition2026 } from './2026';
import { edition2027 } from './2027';

export type { Edition } from './types';

const EDITIONS: Record<string, Edition> = {
  '2026': edition2026,
  '2027': edition2027,
};

/**
 * Édition servie par ce build.
 *
 * REACT_APP_EDITION permet de reconstruire une édition passée à l'identique —
 * c'est ce qui rend 2026.rallyehiver.fr reproductible plutôt que figé.
 */
export const edition: Edition =
  EDITIONS[process.env.REACT_APP_EDITION ?? ''] ?? edition2027;

/**
 * Applique l'habillage de l'édition : l'attribut auquel répondent les feuilles
 * de style, et le chargement des polices correspondantes.
 *
 * Les polices sont chargées ici plutôt que dans index.html pour qu'une édition
 * n'emporte jamais celles des autres.
 */
export function applyEditionTheme(): void {
  document.documentElement.setAttribute('data-edition', edition.theme.key);

  const existant = document.getElementById('edition-fonts');
  if (existant) return;

  const lien = document.createElement('link');
  lien.id = 'edition-fonts';
  lien.rel = 'stylesheet';
  lien.href = edition.theme.fonts;
  document.head.appendChild(lien);
}
