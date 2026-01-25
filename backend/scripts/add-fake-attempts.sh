#!/bin/bash

# Script to add fake password attempts for testing

set -e

PROFILE="claude-admin"

echo "=== Adding Fake Password Attempts ==="
echo ""

# Teams
TEAM1="6a13f829-225c-4936-a1e5-acd72ac2661d" # OUI LOVE PARIS
TEAM2="0d53bc70-c886-4a00-ac95-9bded34effa1" # Les Poulbots
TEAM3="1ada8d9e-1a42-4c0e-9269-65bc5dfe8acb" # Les Pieuvres

# Enigmas
ENIGMA1="e17a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c" # Pierre Tombal
ENIGMA2="e06a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c" # Mademoiselle Chiffre
ENIGMA3="e13a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c" # Un Adversaire coriace

# User ID (fake)
USER_ID="00000000-0000-0000-0000-000000000000"

# Current timestamp
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Subtract various days for testing timeline
DAY_AGO=$(date -u -v-1d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%dT%H:%M:%S.000Z")
TWO_DAYS_AGO=$(date -u -v-2d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "2 days ago" +"%Y-%m-%dT%H:%M:%S.000Z")
THREE_DAYS_AGO=$(date -u -v-3d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "3 days ago" +"%Y-%m-%dT%H:%M:%S.000Z")
WEEK_AGO=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "7 days ago" +"%Y-%m-%dT%H:%M:%S.000Z")

echo "Adding attempts for team: OUI LOVE PARIS"

# Team 1 - Multiple attempts on different enigmas
for i in {1..3}; do
  ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  aws dynamodb put-item \
    --table-name rallye-hiver-backend-password-attempts \
    --item "{
      \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
      \"teamId\": {\"S\": \"$TEAM1\"},
      \"enigmaId\": {\"S\": \"$ENIGMA1\"},
      \"teamEnigmaKey\": {\"S\": \"${TEAM1}#${ENIGMA1}\"},
      \"password\": {\"S\": \"test$i\"},
      \"success\": {\"BOOL\": false},
      \"attemptedAt\": {\"S\": \"$NOW\"},
      \"attemptedBy\": {\"S\": \"$USER_ID\"}
    }" \
    --profile $PROFILE > /dev/null
  echo "  Added failed attempt $i for Pierre Tombal"
done

echo "Adding attempts for team: Les Poulbots"

# Team 2 - Some successful, some failed
for i in {1..2}; do
  ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  aws dynamodb put-item \
    --table-name rallye-hiver-backend-password-attempts \
    --item "{
      \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
      \"teamId\": {\"S\": \"$TEAM2\"},
      \"enigmaId\": {\"S\": \"$ENIGMA2\"},
      \"teamEnigmaKey\": {\"S\": \"${TEAM2}#${ENIGMA2}\"},
      \"password\": {\"S\": \"wrong$i\"},
      \"success\": {\"BOOL\": false},
      \"attemptedAt\": {\"S\": \"$DAY_AGO\"},
      \"attemptedBy\": {\"S\": \"$USER_ID\"}
    }" \
    --profile $PROFILE > /dev/null
  echo "  Added failed attempt $i for Mademoiselle Chiffre (1 day ago)"
done

# Add one successful attempt
ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
aws dynamodb put-item \
  --table-name rallye-hiver-backend-password-attempts \
  --item "{
    \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
    \"teamId\": {\"S\": \"$TEAM2\"},
    \"enigmaId\": {\"S\": \"$ENIGMA2\"},
    \"teamEnigmaKey\": {\"S\": \"${TEAM2}#${ENIGMA2}\"},
    \"password\": {\"S\": \"CORRECT\"},
    \"success\": {\"BOOL\": true},
    \"attemptedAt\": {\"S\": \"$DAY_AGO\"},
    \"attemptedBy\": {\"S\": \"$USER_ID\"}
  }" \
  --profile $PROFILE > /dev/null
echo "  Added SUCCESSFUL attempt for Mademoiselle Chiffre (1 day ago)"

echo "Adding attempts for team: Les Pieuvres"

# Team 3 - Spread across different days
ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
aws dynamodb put-item \
  --table-name rallye-hiver-backend-password-attempts \
  --item "{
    \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
    \"teamId\": {\"S\": \"$TEAM3\"},
    \"enigmaId\": {\"S\": \"$ENIGMA3\"},
    \"teamEnigmaKey\": {\"S\": \"${TEAM3}#${ENIGMA3}\"},
    \"password\": {\"S\": \"test1\"},
    \"success\": {\"BOOL\": false},
    \"attemptedAt\": {\"S\": \"$THREE_DAYS_AGO\"},
    \"attemptedBy\": {\"S\": \"$USER_ID\"}
  }" \
  --profile $PROFILE > /dev/null
echo "  Added failed attempt for Un Adversaire coriace (3 days ago)"

ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
aws dynamodb put-item \
  --table-name rallye-hiver-backend-password-attempts \
  --item "{
    \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
    \"teamId\": {\"S\": \"$TEAM3\"},
    \"enigmaId\": {\"S\": \"$ENIGMA3\"},
    \"teamEnigmaKey\": {\"S\": \"${TEAM3}#${ENIGMA3}\"},
    \"password\": {\"S\": \"test2\"},
    \"success\": {\"BOOL\": false},
    \"attemptedAt\": {\"S\": \"$TWO_DAYS_AGO\"},
    \"attemptedBy\": {\"S\": \"$USER_ID\"}
  }" \
  --profile $PROFILE > /dev/null
echo "  Added failed attempt for Un Adversaire coriace (2 days ago)"

ATTEMPT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
aws dynamodb put-item \
  --table-name rallye-hiver-backend-password-attempts \
  --item "{
    \"attemptId\": {\"S\": \"$ATTEMPT_ID\"},
    \"teamId\": {\"S\": \"$TEAM3\"},
    \"enigmaId\": {\"S\": \"$ENIGMA1\"},
    \"teamEnigmaKey\": {\"S\": \"${TEAM3}#${ENIGMA1}\"},
    \"password\": {\"S\": \"SUCCESS\"},
    \"success\": {\"BOOL\": true},
    \"attemptedAt\": {\"S\": \"$WEEK_AGO\"},
    \"attemptedBy\": {\"S\": \"$USER_ID\"}
  }" \
  --profile $PROFILE > /dev/null
echo "  Added SUCCESSFUL attempt for Pierre Tombal (7 days ago)"

echo ""
echo "=== Summary ==="
echo "Added 9 fake password attempts:"
echo "  - OUI LOVE PARIS: 3 failed attempts (recent)"
echo "  - Les Poulbots: 2 failed + 1 successful (1 day ago)"
echo "  - Les Pieuvres: 2 failed + 1 successful (spread over time)"
echo ""
echo "✓ Done!"
