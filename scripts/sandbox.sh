#!/bin/bash
# Bacs à sable : une stack AWS entièrement isolée par agent de développement.
#
#   ./scripts/sandbox.sh create <nom> <port>   # monte le bac à sable
#   ./scripts/sandbox.sh deploy <nom>          # redéploie le backend courant
#
# Pourquoi : deux agents qui déploient sur la même stack de test se marchent
# dessus : chaque déploiement écrase les lambdas de l'autre, et leurs jeux de
# données se mélangent. Les tables sont nommées « ${self:service}-<table> » et
# le pool Cognito « ${self:service}-user-pool » : changer le seul nom de service
# suffit donc à obtenir des tables vides, un pool vide et une API distincte,
# sans toucher d'une ligne à la stack de test. Le surcoût est nul en pratique
# (DynamoDB en pay-per-request, lambdas facturées à l'appel).
#
# Ce script est strictement additif : il ne supprime rien et ne déploie jamais
# backend/serverless.yml ni backend/serverless-test.yml. Le démontage d'un bac
# à sable n'est volontairement pas outillé ici (voir backend/README.md).

set -euo pipefail

PROFIL="rallye-test"
REGION="eu-west-1"
COMPTE_ATTENDU="516341735006"

# Stack dont on copie ce qui est partageable : clés Stripe de test et forme de
# la configuration du bucket des énigmes.
STAGE_REFERENCE="test"

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
MODELE="$RACINE/backend/serverless-test.yml"

# Valeurs d'amorçage. Le bloc provider.environment lit les identifiants Cognito
# dans SSM *avant* que la stack ne crée le pool : il faut donc y poser des
# valeurs de forme plausible pour que le premier déploiement passe, puis les
# remplacer par les vraies et redéployer. Ces trois valeurs signalent
# « paramètre non encore renseigné » et sont les seules que le script réécrit.
AMORCE_POOL="eu-west-1_AMORCAGE"
AMORCE_CLIENT="amorcage"
AMORCE_CLE_API="A-REMPLACER"

aws_() { AWS_PROFILE="$PROFIL" aws --region "$REGION" "$@"; }

echec() { echo "✗ $*" >&2; exit 1; }

usage() {
  cat >&2 <<'FIN'
Usage :
  ./scripts/sandbox.sh create <nom> <port>   Crée SSM, bucket, stack et .env frontend
  ./scripts/sandbox.sh deploy <nom>          Redéploie la stack du bac à sable

  <nom>  : ^[a-z][a-z0-9-]{1,20}$, ni « test » ni « prod »
  <port> : port du frontend local (3002, 3003, ...)
FIN
  exit 1
}

# --- Gardes -----------------------------------------------------------------

valider_nom() {
  local nom="${1:-}"

  # « test » et « prod » désignent les stacks réelles : les accepter ici
  # reviendrait à pointer le script sur l'environnement qu'il doit épargner.
  case "$nom" in
    test|prod) echec "« $nom » est un environnement réel, pas un bac à sable." ;;
  esac

  # Le nom sert de nom de service, de stage, de suffixe de bucket et de nom de
  # stack CloudFormation : on le restreint à ce que ces quatre usages acceptent.
  [[ "$nom" =~ ^[a-z][a-z0-9-]{1,20}$ ]] \
    || echec "Nom invalide « $nom » : attendu ^[a-z][a-z0-9-]{1,20}$."
}

# Les tables et le pool portent « DeletionPolicy: Retain » : si un premier
# déploiement échoue, CloudFormation supprime la stack mais laisse les tables
# derrière lui. Un nouveau « create » se heurterait alors à « table already
# exists », message qui n'explique rien. On diagnostique ici plutôt que de
# laisser CloudFormation le faire, et on s'arrête : effacer des tables n'est
# pas du ressort de ce script.
verifier_orphelins() {
  local nom="$1"
  local stack="rallye-hiver-backend-$nom-$nom"

  aws_ cloudformation describe-stacks --stack-name "$stack" >/dev/null 2>&1 && return 0

  local orphelines
  orphelines="$(aws_ dynamodb list-tables \
    --query "TableNames[?starts_with(@, 'rallye-hiver-backend-$nom-')]" --output text)"

  [ -z "$orphelines" ] && return 0

  echo "✗ La stack $stack n'existe pas, mais ses tables oui :" >&2
  echo "  $orphelines" >&2
  echo "  Un déploiement précédent a échoué et les a laissées derrière lui." >&2
  echo "  Il faut les réimporter dans la stack ou les supprimer (geste humain)." >&2
  exit 1
}

valider_port() {
  local port="${1:-}"
  [[ "$port" =~ ^[0-9]{4,5}$ ]] || echec "Port invalide « $port »."
}

verifier_compte() {
  local compte
  compte="$(aws_ sts get-caller-identity --query Account --output text)" \
    || echec "Session AWS invalide. Lance : aws sso login --profile $PROFIL"

  # Dernier rempart : ce script n'a rien à faire ailleurs que dans le compte de
  # test, quelle que soit la configuration locale du profil.
  [ "$compte" = "$COMPTE_ATTENDU" ] \
    || echec "Compte AWS $compte au lieu de $COMPTE_ATTENDU (profil $PROFIL)."
}

# --- Paramètres SSM ---------------------------------------------------------

ssm_lire() {
  aws_ ssm get-parameter --name "$1" --with-decryption \
    --query 'Parameter.Value' --output text 2>/dev/null || true
}

est_amorce() {
  case "$1" in
    "$AMORCE_POOL"|"$AMORCE_CLIENT"|"$AMORCE_CLE_API"|None|"") return 0 ;;
    *) return 1 ;;
  esac
}

# Pose un paramètre s'il est absent ou encore à sa valeur d'amorçage. Un
# paramètre déjà renseigné n'est jamais réécrit : relancer « create » ne doit
# pas écraser une vraie clé posée à la main.
ssm_poser() {
  local chemin="$1" valeur="$2" type="$3"
  local existant
  existant="$(ssm_lire "$chemin")"

  if ! est_amorce "$existant"; then
    echo "  = $chemin (déjà renseigné, inchangé)"
    return 0
  fi

  aws_ ssm put-parameter --name "$chemin" --value "$valeur" --type "$type" \
    --overwrite >/dev/null
  echo "  + $chemin"
}

# Copie un paramètre depuis /rallye-hiver/test/, en conservant son type : les
# clés Stripe sont des clés de *test*, partageables entre bacs à sable, et les
# redemander à l'opérateur à chaque création n'apporterait rien.
ssm_copier_depuis_test() {
  local nom="$1" cle="$2"
  local source="/rallye-hiver/$STAGE_REFERENCE/$cle"
  local brut valeur type

  brut="$(aws_ ssm get-parameter --name "$source" --with-decryption \
    --query 'Parameter.[Value,Type]' --output text 2>/dev/null || true)"
  [ -n "$brut" ] || echec "Paramètre source introuvable : $source"

  valeur="$(printf '%s' "$brut" | cut -f1)"
  type="$(printf '%s' "$brut" | cut -f2)"

  ssm_poser "/rallye-hiver/$nom/$cle" "$valeur" "$type"
}

parametres_ssm() {
  local nom="$1" port="$2"
  echo "→ Paramètres SSM sous /rallye-hiver/$nom/"

  ssm_copier_depuis_test "$nom" stripe-secret-key
  ssm_copier_depuis_test "$nom" stripe-webhook-secret
  ssm_copier_depuis_test "$nom" stripe-price-id

  local origine="http://localhost:$port"
  local origine_actuelle
  origine_actuelle="$(ssm_lire "/rallye-hiver/$nom/cors-origin")"

  if [ -n "$origine_actuelle" ] && [ "$origine_actuelle" != "None" ] \
     && [ "$origine_actuelle" != "$origine" ]; then
    echo "  ! cors-origin vaut « $origine_actuelle » et non « $origine »."
    echo "    Un paramètre renseigné n'est pas réécrit ; corrige-le à la main"
    echo "    si le port du frontend a changé."
  fi

  ssm_poser "/rallye-hiver/$nom/cors-origin" "$origine" String

  # Amorçage : ces deux valeurs seront remplacées après le premier déploiement.
  ssm_poser "/rallye-hiver/$nom/cognito-user-pool-id" "$AMORCE_POOL" String
  ssm_poser "/rallye-hiver/$nom/cognito-client-id" "$AMORCE_CLIENT" String

  # Pas encore lue par le backend : posée pour le chantier qui en aura besoin,
  # avec une valeur d'amorçage que le commanditaire remplacera par la vraie clé.
  ssm_poser "/rallye-hiver/$nom/anthropic-api-key" "$AMORCE_CLE_API" SecureString
}

# --- Bucket des énigmes -----------------------------------------------------

creer_bucket() {
  local nom="$1" port="$2"
  local bucket="rallyehiver-enigmas-$nom"

  echo "→ Bucket s3://$bucket"

  if aws_ s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "  = déjà présent"
  else
    aws_ s3api create-bucket --bucket "$bucket" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
    echo "  + créé"
  fi

  # Comme le bucket de test : propriété du compte imposée, donc pas d'ACL
  # d'objet. Le bac à sable reste privé, contrairement au bucket de test, qui
  # porte encore une politique de lecture publique héritée (bucket-policy.json).
  # Les PDF n'y sont déposés que par URL présignée, et l'accès en lecture passe
  # par les identifiants du compte : rien n'exige une ouverture publique ici.
  aws_ s3api put-bucket-ownership-controls --bucket "$bucket" \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]' >/dev/null

  # Mêmes règles CORS que rallyehiver-enigmas-test, à l'origine près : le
  # frontend d'un bac à sable tourne en local, pas sur test.rallyehiver.fr.
  aws_ s3api put-bucket-cors --bucket "$bucket" --cors-configuration "$(cat <<FIN
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["http://localhost:$port"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
FIN
)" >/dev/null
  echo "  = CORS posé (origine http://localhost:$port)"
}

# --- Génération du serverless du bac à sable --------------------------------

# Remplacement littéral, avec contrôle du nombre d'occurrences : si
# serverless-test.yml évolue et qu'un repère disparaît ou se démultiplie, on
# s'arrête ici plutôt que de déployer une configuration à moitié transposée.
remplacer() {
  local fichier="$1" motif="$2" remplacement="$3" attendu="$4"
  local trouve

  trouve="$(grep -F -o -- "$motif" "$fichier" | wc -l | tr -d ' ')"

  if [ "$trouve" != "$attendu" ]; then
    echo "✗ Repère « $motif » : $trouve occurrence(s), $attendu attendue(s)." >&2
    echo "  backend/serverless-test.yml a changé de forme :" >&2
    echo "  mets à jour scripts/sandbox.sh avant de déployer." >&2
    exit 1
  fi

  MOTIF="$motif" REMPLACEMENT="$remplacement" \
    perl -0pi -e 's/\Q$ENV{MOTIF}\E/$ENV{REMPLACEMENT}/g' "$fichier"
}

# Le modèle est toujours le serverless-test.yml du worktree courant : chaque
# agent déploie donc sa propre branche, pas une copie figée.
generer_yml() {
  local nom="$1"
  local cible="$RACINE/backend/.sandbox-$nom.yml"

  [ -f "$MODELE" ] || echec "Modèle introuvable : $MODELE"

  echo "→ Génération de backend/.sandbox-$nom.yml depuis serverless-test.yml"
  cp "$MODELE" "$cible"

  # Le nom du service commande tout : tables, pool Cognito, nom de stack, nom
  # d'API. Le stage ne sert qu'aux chemins SSM et au suffixe d'URL.
  remplacer "$cible" "service: rallye-hiver-backend-test" \
                     "service: rallye-hiver-backend-$nom" 1
  remplacer "$cible" "stage: test" "stage: $nom" 1
  # Deux occurrences : la variable d'environnement et l'ARN de la politique IAM.
  remplacer "$cible" "rallyehiver-enigmas-test" "rallyehiver-enigmas-$nom" 2
  # Suffixe de l'URL exposée par l'Output ServiceEndpoint.
  remplacer "$cible" ".amazonaws.com/test" ".amazonaws.com/$nom" 1

  # Reste volontairement inchangé : le libellé « environnement test » du courriel
  # Cognito de réinitialisation, purement cosmétique et sans effet technique.

  raccourcir_noms_lambda "$nom" "$cible"
}

# AWS borne un nom de lambda à 64 caractères, et Serverless le compose en
# « <service>-<stage>-<clé> ». Un nom de bac à sable plus long que « test »
# rallonge les deux premiers morceaux : avec « indices », la fonction
# adminPasswordAttemptsTimeline atteint 66 caractères et le déploiement est
# refusé par l'API Lambda. On pose donc un nom explicite, tronqué, pour les
# seules fonctions qui débordent ; les autres gardent leur nom par défaut, et
# « serverless logs -f <clé> » continue de fonctionner puisqu'il passe par la
# configuration.
raccourcir_noms_lambda() {
  local nom="$1" fichier="$2"

  PREFIXE="rallye-hiver-backend-$nom-$nom-" perl -i -pe '
    BEGIN { our %vus; our $dans = 0; }
    if (/^functions:\s*$/) { $dans = 1 }
    elsif (/^\S/) { $dans = 0 }
    if ($dans && /^  ([A-Za-z0-9_]+):\s*$/) {
      my $complet = $ENV{PREFIXE} . $1;
      if (length($complet) > 64) {
        my $court = substr($complet, 0, 64);
        die "Troncature ambiguë : $court est déjà pris par $vus{$court}.\n"
          if exists $vus{$court};
        $vus{$court} = $1;
        $_ .= "    name: $court\n";
        print STDERR "  ~ $1 : nom de lambda tronqué en $court\n";
      }
    }
  ' "$fichier"
}

# --- Déploiement et amorçage Cognito ----------------------------------------

deployer() {
  local nom="$1"
  echo "→ serverless deploy (.sandbox-$nom.yml)"
  ( cd "$RACINE/backend" \
    && AWS_PROFILE="$PROFIL" npx serverless deploy \
         --config ".sandbox-$nom.yml" --stage "$nom" )
}

sortie_stack() {
  local nom="$1" cle="$2"
  aws_ cloudformation describe-stacks \
    --stack-name "rallye-hiver-backend-$nom-$nom" \
    --query "Stacks[0].Outputs[?OutputKey=='$cle'].OutputValue" \
    --output text 2>/dev/null || true
}

# Cherche le pool par son nom si les Outputs ne répondent pas : la stack les
# expose (UserPoolId, UserPoolClientId), mais un déploiement partiel peut les
# laisser indisponibles.
pool_par_nom() {
  local nom="$1"
  aws_ cognito-idp list-user-pools --max-results 60 \
    --query "UserPools[?Name=='rallye-hiver-backend-$nom-user-pool'].Id | [0]" \
    --output text
}

client_par_nom() {
  local pool="$1" nom="$2"
  aws_ cognito-idp list-user-pool-clients --user-pool-id "$pool" --max-results 60 \
    --query "UserPoolClients[?ClientName=='rallye-hiver-backend-$nom-client'].ClientId | [0]" \
    --output text
}

# Renvoie 0 si SSM a été mis à jour (donc s'il faut redéployer).
synchroniser_cognito() {
  local nom="$1"
  local pool client change=1

  pool="$(sortie_stack "$nom" UserPoolId)"
  [ -n "$pool" ] && [ "$pool" != "None" ] || pool="$(pool_par_nom "$nom")"
  [ -n "$pool" ] && [ "$pool" != "None" ] \
    || echec "Pool Cognito du bac à sable « $nom » introuvable."

  client="$(sortie_stack "$nom" UserPoolClientId)"
  [ -n "$client" ] && [ "$client" != "None" ] || client="$(client_par_nom "$pool" "$nom")"
  [ -n "$client" ] && [ "$client" != "None" ] \
    || echec "Client Cognito du bac à sable « $nom » introuvable."

  echo "→ Identifiants Cognito réels : $pool / $client"

  if [ "$(ssm_lire "/rallye-hiver/$nom/cognito-user-pool-id")" != "$pool" ]; then
    aws_ ssm put-parameter --name "/rallye-hiver/$nom/cognito-user-pool-id" \
      --value "$pool" --type String --overwrite >/dev/null
    echo "  ~ cognito-user-pool-id mis à jour"
    change=0
  fi

  if [ "$(ssm_lire "/rallye-hiver/$nom/cognito-client-id")" != "$client" ]; then
    aws_ ssm put-parameter --name "/rallye-hiver/$nom/cognito-client-id" \
      --value "$client" --type String --overwrite >/dev/null
    echo "  ~ cognito-client-id mis à jour"
    change=0
  fi

  POOL_ID="$pool"
  CLIENT_ID="$client"
  return $change
}

# Contrôle final : ce sont les variables d'environnement des lambdas qui
# comptent, pas le contenu de SSM. Un redéploiement oublié se verrait ici.
verifier_lambda() {
  local nom="$1"
  local fonction="rallye-hiver-backend-$nom-$nom-login"
  local pool client

  pool="$(aws_ lambda get-function-configuration --function-name "$fonction" \
    --query 'Environment.Variables.COGNITO_USER_POOL_ID' --output text)"
  client="$(aws_ lambda get-function-configuration --function-name "$fonction" \
    --query 'Environment.Variables.COGNITO_CLIENT_ID' --output text)"

  [ "$pool" = "$POOL_ID" ] && [ "$client" = "$CLIENT_ID" ] \
    || echec "La lambda $fonction porte encore $pool / $client au lieu de $POOL_ID / $CLIENT_ID."

  echo "→ Lambda $fonction : identifiants Cognito conformes"
}

# L'URL est recomposée à partir de l'identifiant de l'API, et non lue dans
# l'Output ServiceEndpoint : celui-ci est corrompu, sur la pile de test comme
# ici. Serverless produit son propre Output du même nom, et la fusion avec
# celui écrit à la main dans serverless-test.yml donne
# « ...amazonaws.com/testamazonaws.com/test ». Le défaut est antérieur et sans
# conséquence (personne ne lit cet Output), mais il ne faut pas s'y fier.
url_api() {
  local nom="$1"
  local api
  api="$(aws_ cloudformation describe-stack-resource \
    --stack-name "rallye-hiver-backend-$nom-$nom" \
    --logical-resource-id ApiGatewayRestApi \
    --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || true)"

  [ -n "$api" ] && [ "$api" != "None" ] \
    || echec "API Gateway du bac à sable « $nom » introuvable."

  printf 'https://%s.execute-api.%s.amazonaws.com/%s' "$api" "$REGION" "$nom"
}

# --- Fichier d'environnement du frontend ------------------------------------

ecrire_env_frontend() {
  local nom="$1" port="$2" url="$3"
  local fichier="$RACINE/frontend/.env.sandbox-$nom"

  # Seuls REACT_APP_API_URL et PORT sont lus par le code aujourd'hui : le
  # frontend délègue l'authentification à l'API et ne parle pas à Cognito
  # directement. Les trois variables Cognito sont écrites quand même, parce que
  # .env.example et scripts/deploy-frontend.sh les portent déjà et qu'elles
  # redeviendront nécessaires si le frontend reprend un SDK Cognito.
  cat > "$fichier" <<FIN
# Bac à sable « $nom ». Généré par scripts/sandbox.sh, ne pas committer.
#   cp frontend/.env.sandbox-$nom frontend/.env.local && cd frontend && npm start
REACT_APP_API_URL=$url
REACT_APP_COGNITO_USER_POOL_ID=$POOL_ID
REACT_APP_COGNITO_CLIENT_ID=$CLIENT_ID
REACT_APP_COGNITO_REGION=$REGION
PORT=$port
FIN

  echo "→ frontend/.env.sandbox-$nom écrit"
}

# --- Commandes --------------------------------------------------------------

cmd_create() {
  local nom="${1:-}" port="${2:-}"
  valider_nom "$nom"
  valider_port "$port"
  verifier_compte

  echo "== Bac à sable « $nom » (frontend sur le port $port) =="

  verifier_orphelins "$nom"
  parametres_ssm "$nom" "$port"
  creer_bucket "$nom" "$port"
  generer_yml "$nom"

  # Premier passage : crée le pool Cognito, avec des identifiants d'amorçage
  # dans les variables d'environnement des lambdas.
  deployer "$nom"

  # Deuxième passage : les lambdas reçoivent les vrais identifiants.
  if synchroniser_cognito "$nom"; then
    echo "→ Redéploiement pour propager les identifiants Cognito réels"
    deployer "$nom"
  else
    echo "→ SSM déjà à jour, pas de second déploiement"
  fi

  verifier_lambda "$nom"

  local url
  url="$(url_api "$nom")"
  ecrire_env_frontend "$nom" "$port" "$url"

  recapitulatif "$nom" "$port" "$url"
}

cmd_deploy() {
  local nom="${1:-}"
  valider_nom "$nom"
  verifier_compte

  [ -n "$(ssm_lire "/rallye-hiver/$nom/cors-origin")" ] \
    || echec "Bac à sable « $nom » inconnu. Lance d'abord : $0 create $nom <port>"

  generer_yml "$nom"
  deployer "$nom"

  if synchroniser_cognito "$nom"; then
    echo "→ Redéploiement pour propager les identifiants Cognito réels"
    deployer "$nom"
  fi

  verifier_lambda "$nom"
  echo "✓ Bac à sable « $nom » redéployé : $(url_api "$nom")"
}

recapitulatif() {
  local nom="$1" port="$2" url="$3"

  cat <<FIN

== Bac à sable « $nom » prêt ==

  API            : $url
  Pool Cognito   : $POOL_ID
  Client Cognito : $CLIENT_ID
  Tables         : rallye-hiver-backend-$nom-<table> (vides)
  Bucket         : s3://rallyehiver-enigmas-$nom
  Paramètres     : /rallye-hiver/$nom/

Frontend :
  cp frontend/.env.sandbox-$nom frontend/.env.local && cd frontend && npm start

Décor de test (comptes e2e + équipe de test) :
  cd tests && TEST_ENV=$nom npm run provision

Compte d'administration :
  cd tests && TEST_ENV=$nom node scripts/make-admin.js <email> <mot-de-passe>

Itération backend suivante :
  ./scripts/sandbox.sh deploy $nom

La clé /rallye-hiver/$nom/anthropic-api-key vaut encore « $AMORCE_CLE_API ».
Le démontage d'un bac à sable n'est pas outillé : il se fait après validation.
FIN
}

case "${1:-}" in
  create) shift; cmd_create "$@" ;;
  deploy) shift; cmd_deploy "$@" ;;
  *) usage ;;
esac
