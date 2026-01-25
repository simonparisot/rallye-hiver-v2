#!/bin/bash

# Script to reset rally progress data
# This will delete all password attempts, team progress, and parcours access

set -e

PROFILE="claude-admin"

echo "=== Resetting Rally Data ==="
echo ""

# 1. Delete all password attempts
echo "1. Deleting password attempts..."
ATTEMPTS=$(aws dynamodb scan --table-name rallye-hiver-backend-password-attempts --profile $PROFILE --output json | jq -c '.Items[]')
COUNT=0
while IFS= read -r item; do
  ATTEMPT_ID=$(echo "$item" | jq -r '.attemptId.S')
  aws dynamodb delete-item \
    --table-name rallye-hiver-backend-password-attempts \
    --key "{\"attemptId\":{\"S\":\"$ATTEMPT_ID\"}}" \
    --profile $PROFILE
  COUNT=$((COUNT + 1))
  echo "  Deleted attempt $COUNT: $ATTEMPT_ID"
done <<< "$ATTEMPTS"
echo "  ✓ Deleted $COUNT password attempts"
echo ""

# 2. Delete all team enigma progress
echo "2. Deleting team enigma progress..."
PROGRESS=$(aws dynamodb scan --table-name rallye-hiver-backend-team-enigma-progress --profile $PROFILE --output json | jq -c '.Items[]')
COUNT=0
while IFS= read -r item; do
  TEAM_ID=$(echo "$item" | jq -r '.teamId.S')
  ENIGMA_ID=$(echo "$item" | jq -r '.enigmaId.S')
  aws dynamodb delete-item \
    --table-name rallye-hiver-backend-team-enigma-progress \
    --key "{\"teamId\":{\"S\":\"$TEAM_ID\"},\"enigmaId\":{\"S\":\"$ENIGMA_ID\"}}" \
    --profile $PROFILE
  COUNT=$((COUNT + 1))
  echo "  Deleted progress $COUNT: Team $TEAM_ID - Enigma $ENIGMA_ID"
done <<< "$PROGRESS"
echo "  ✓ Deleted $COUNT team enigma progress records"
echo ""

# 3. Delete all team parcours access
echo "3. Deleting team parcours access..."
ACCESS=$(aws dynamodb scan --table-name rallye-hiver-backend-team-parcours-access --profile $PROFILE --output json | jq -c '.Items[]')
COUNT=0
while IFS= read -r item; do
  TEAM_ID=$(echo "$item" | jq -r '.teamId.S')
  PARCOURS_ID=$(echo "$item" | jq -r '.parcoursId.S')
  aws dynamodb delete-item \
    --table-name rallye-hiver-backend-team-parcours-access \
    --key "{\"teamId\":{\"S\":\"$TEAM_ID\"},\"parcoursId\":{\"S\":\"$PARCOURS_ID\"}}" \
    --profile $PROFILE
  COUNT=$((COUNT + 1))
  echo "  Deleted access $COUNT: Team $TEAM_ID - Parcours $PARCOURS_ID"
done <<< "$ACCESS"
echo "  ✓ Deleted $COUNT team parcours access records"
echo ""

# 4. Reset solvedEnigmasCount for all teams
echo "4. Resetting team solved enigma counts..."
TEAMS=$(aws dynamodb scan --table-name rallye-hiver-backend-teams --profile $PROFILE --output json | jq -c '.Items[]')
COUNT=0
while IFS= read -r item; do
  TEAM_ID=$(echo "$item" | jq -r '.teamId.S')
  TEAM_NAME=$(echo "$item" | jq -r '.teamName.S')

  # Check if team has solvedEnigmasCount
  SOLVED_COUNT=$(echo "$item" | jq -r '.solvedEnigmasCount.N // "0"')

  if [ "$SOLVED_COUNT" != "0" ]; then
    aws dynamodb update-item \
      --table-name rallye-hiver-backend-teams \
      --key "{\"teamId\":{\"S\":\"$TEAM_ID\"}}" \
      --update-expression "SET solvedEnigmasCount = :zero" \
      --expression-attribute-values '{":zero":{"N":"0"}}' \
      --profile $PROFILE
    COUNT=$((COUNT + 1))
    echo "  Reset team $TEAM_NAME (had $SOLVED_COUNT solved)"
  fi
done <<< "$TEAMS"
echo "  ✓ Reset $COUNT team counters"
echo ""

echo "=== Rally Reset Complete ==="
