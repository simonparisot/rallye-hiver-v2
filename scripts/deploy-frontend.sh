#!/bin/bash
# Construit et publie le frontend sur un environnement.
#
#   ./scripts/deploy-frontend.sh test
#
# La production n'est volontairement pas gérée par ce script : elle relève d'un
# geste délibéré, pas d'un utilitaire qu'on lance de mémoire.

set -euo pipefail

# Sans cela, un échec de publication passe inaperçu dès que la sortie est
# filtrée par un grep : le code de retour est celui du dernier maillon du tube.
# C'est arrivé — une session AWS expirée a laissé croire à un déploiement réussi.

ENVIRONNEMENT="${1:-}"

case "$ENVIRONNEMENT" in
  test)
    PROFIL="rallye-test"
    BUCKET="test.rallyehiver.fr"
    DISTRIBUTION="E104E5O2KDVFJN"
    API_URL="https://010h0tev7c.execute-api.eu-west-1.amazonaws.com/test"
    POOL_ID="eu-west-1_Sxj76KSAf"
    CLIENT_ID="76s9a0gtb59bem03urs771tovt"
    ;;
  prod)
    PROFIL="rallye"
    # Nom historique : ce bucket sert l'application de jeu, désormais
    # exposée sur 2026.rallyehiver.fr. rallyehiver.fr sert le site vitrine.
    BUCKET="proto.rallyehiver.fr"
    DISTRIBUTION="E2M1D4SPTNMDIK"
    API_URL="https://rpg0alko8b.execute-api.eu-west-1.amazonaws.com/prod"
    POOL_ID="eu-west-1_cRMw8lhM3"
    CLIENT_ID="150sbtrvqtc885mpvp8i1sjck"
    echo "⚠  Publication en PRODUCTION sur https://2026.rallyehiver.fr"
    ;;
  *)
    echo "Usage : $0 test|prod" >&2
    exit 1
    ;;
esac

RACINE="$(cd "$(dirname "$0")/.." && pwd)"

cd "$RACINE/frontend"

# Réinstallation stricte depuis le fichier de verrouillage : sans elle, un
# npm install antérieur peut avoir fait glisser des versions, et le bundle
# publié ne correspondrait plus à ce que décrit le dépôt.
echo "→ Installation des dépendances (npm ci)"
npm ci --silent

echo "→ Construction du frontend pour « $ENVIRONNEMENT »"
REACT_APP_API_URL="$API_URL" \
REACT_APP_COGNITO_USER_POOL_ID="$POOL_ID" \
REACT_APP_COGNITO_CLIENT_ID="$CLIENT_ID" \
REACT_APP_COGNITO_REGION="eu-west-1" \
CI=false \
npm run build

echo "→ Publication sur s3://$BUCKET"
# Les fichiers empreintés sont mis en cache longuement ; index.html ne l'est
# jamais, sans quoi les visiteurs resteraient sur l'ancienne version.
AWS_PROFILE="$PROFIL" aws s3 sync build/ "s3://$BUCKET" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

AWS_PROFILE="$PROFIL" aws s3 cp build/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate"

echo "→ Invalidation du cache CloudFront"
AWS_PROFILE="$PROFIL" aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "✓ Publié sur https://$BUCKET"
