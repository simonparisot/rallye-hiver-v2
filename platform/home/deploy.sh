#!/bin/sh
# Publie le site sur S3. Aucune étape de build : les fichiers sont servis tels quels.
set -e
# Le site est servi par rallyehiver.fr, sur le compte AWS du rallye —
# le reste de l'infrastructure du projet s'y trouve déjà.
BUCKET=s3://home.rallyehiver.fr
PROFILE=rallye
DISTRIBUTION=E2BGPNXDN8XXQX

aws s3 sync . "$BUCKET" --delete --profile "$PROFILE" \
  --exclude '.*' --exclude 'README.md' --exclude 'deploy.sh'

# Les pages ne doivent pas être mises en cache : le contenu change d'une année à l'autre.
aws s3 cp "$BUCKET" "$BUCKET" --recursive --exclude '*' --include '*.html' \
  --metadata-directive REPLACE --content-type 'text/html; charset=utf-8' \
  --cache-control 'no-cache' --profile "$PROFILE"

# Les pages étant en no-cache, seule l'invalidation des ressources statiques
# importe réellement ; on invalide tout, le site tient en 26 fichiers.
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
  --paths '/*' --profile "$PROFILE" --query 'Invalidation.Id' --output text
