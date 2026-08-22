#!/bin/bash
# Construit et publie le frontend sur un environnement.
#
#   ./scripts/deploy-frontend.sh test
#
# La production n'est volontairement pas gérée par ce script : elle relève d'un
# geste délibéré, pas d'un utilitaire qu'on lance de mémoire.

set -euo pipefail

ENVIRONNEMENT="${1:-}"

if [ "$ENVIRONNEMENT" != "test" ]; then
  echo "Usage : $0 test" >&2
  echo "Seul l'environnement de test est publiable par ce script." >&2
  exit 1
fi

PROFIL="rallye-test"
BUCKET="test.rallyehiver.fr"
DISTRIBUTION="E104E5O2KDVFJN"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

cd "$RACINE/frontend"

echo "→ Construction du frontend pour « $ENVIRONNEMENT »"
REACT_APP_API_URL="https://010h0tev7c.execute-api.eu-west-1.amazonaws.com/test" \
REACT_APP_COGNITO_USER_POOL_ID="eu-west-1_Sxj76KSAf" \
REACT_APP_COGNITO_CLIENT_ID="76s9a0gtb59bem03urs771tovt" \
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
