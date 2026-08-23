/**
 * Ramène vers le domaine nu les adresses héritées.
 *
 * rallyehiver.fr sert le site vitrine ; trois anciens noms y conduisent :
 *
 *   www       — les deux noms étaient servis par la même distribution, mais
 *               l'API ne déclare qu'une seule origine CORS : un visiteur
 *               arrivant par « www » voyait ses appels bloqués.
 *   home      — le site vitrine vivait sur ce sous-domaine avant de prendre
 *               la racine.
 *   archives  — servait le même contenu que « home » ; la liste des éditions
 *               passées est désormais une page du site vitrine.
 *
 * La redirection a lieu en viewer-request, avant le cache. Toute autre requête
 * poursuit son chemin inchangée — en particulier 2026.rallyehiver.fr, qui sert
 * l'application de jeu.
 */
var DESTINATIONS = {
  'www.rallyehiver.fr': null,               // même chemin, domaine nu
  'home.rallyehiver.fr': '/',               // l'accueil a changé de place
  'archives.rallyehiver.fr': '/editions.html'
};

function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;

  if (!(host in DESTINATIONS)) {
    return request;
  }

  var cible = DESTINATIONS[host];
  var uri = cible === null ? request.uri : cible;

  // La chaîne de requête n'est conservée que si le chemin l'est aussi :
  // la reporter sur une page d'accueil n'aurait pas de sens.
  var suffixe = '';
  if (cible === null) {
    var parties = [];
    for (var cle in request.querystring) {
      var valeur = request.querystring[cle].value;
      parties.push(valeur ? cle + '=' + valeur : cle);
    }
    if (parties.length) {
      suffixe = '?' + parties.join('&');
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://rallyehiver.fr' + uri + suffixe },
      // Bornée à une heure : de quoi revenir en arrière sans attendre
      // l'expiration des caches navigateur.
      'cache-control': { value: 'max-age=3600' }
    }
  };
}
