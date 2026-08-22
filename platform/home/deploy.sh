#!/bin/sh
# Publie le site sur S3. Aucune étape de build : les fichiers sont servis tels quels.
set -e
BUCKET=s3://rallye-hiver-home
PROFILE=perso

aws s3 sync . "$BUCKET" --delete --profile "$PROFILE" \
  --exclude '.*' --exclude 'README.md' --exclude 'deploy.sh'

# Les pages ne doivent pas être mises en cache : le contenu change d'une année à l'autre.
aws s3 cp "$BUCKET" "$BUCKET" --recursive --exclude '*' --include '*.html' \
  --metadata-directive REPLACE --content-type 'text/html; charset=utf-8' \
  --cache-control 'no-cache' --profile "$PROFILE"
