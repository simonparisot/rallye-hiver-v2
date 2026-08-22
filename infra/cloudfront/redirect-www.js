/**
 * Redirige www.rallyehiver.fr vers le domaine nu.
 *
 * Les deux noms sont servis par la même distribution, mais l'API ne déclare
 * qu'une seule origine autorisée dans son en-tête CORS. Un visiteur arrivant
 * par « www » voyait donc ses appels bloqués par le navigateur : page qui
 * s'affiche, mais connexion impossible.
 *
 * La redirection a lieu en viewer-request, avant le cache, et ne concerne que
 * l'hôte « www » — toute autre requête poursuit son chemin inchangée.
 */
function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;

  if (host !== 'www.rallyehiver.fr') {
    return request;
  }

  // La chaîne de requête est préservée : un lien partagé avec des paramètres
  // doit continuer de fonctionner après redirection.
  var querystring = [];
  for (var cle in request.querystring) {
    var valeur = request.querystring[cle].value;
    querystring.push(valeur ? cle + '=' + valeur : cle);
  }

  var destination = 'https://rallyehiver.fr' + request.uri
    + (querystring.length ? '?' + querystring.join('&') : '');

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: destination },
      // Une redirection permanente est mise en cache par les navigateurs :
      // on la borne à une heure pour pouvoir revenir en arrière sans attendre.
      'cache-control': { value: 'max-age=3600' }
    }
  };
}
