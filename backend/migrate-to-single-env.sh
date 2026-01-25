#!/bin/bash
set -e

echo "🔄 Migrating Rallye d'Hiver to Single Environment"
echo "=================================================="
echo ""

# Check AWS credentials
echo "✓ Checking AWS credentials..."
AWS_PROFILE=claude-admin aws sts get-caller-identity > /dev/null || {
    echo "❌ AWS credentials expired. Please run:"
    echo "   aws sso login --profile claude-admin"
    exit 1
}

echo "✓ AWS credentials OK"
echo ""

# Deploy the new configuration
echo "📦 Deploying backend with single environment configuration..."
cd "$(dirname "$0")"
AWS_PROFILE=claude-admin npm run deploy

echo ""
echo "✓ Deployment complete"
echo ""

# Get the new API endpoint
API_ENDPOINT=$(AWS_PROFILE=claude-admin aws cloudformation describe-stacks \
    --stack-name rallye-hiver-backend-prod \
    --region eu-west-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ServiceEndpoint`].OutputValue' \
    --output text)

echo "📍 New API Endpoint: $API_ENDPOINT"
echo ""

# Migrate data from dev to prod tables
echo "🔄 Migrating data from dev tables to prod tables..."
echo ""

# Function to copy table data
copy_table_data() {
    local source_table=$1
    local dest_table=$2

    echo "  Copying $source_table → $dest_table..."

    # Scan source table
    local items=$(AWS_PROFILE=claude-admin aws dynamodb scan \
        --table-name "$source_table" \
        --region eu-west-1 \
        --output json | jq -c '.Items[]')

    local count=0
    while IFS= read -r item; do
        if [ -n "$item" ]; then
            AWS_PROFILE=claude-admin aws dynamodb put-item \
                --table-name "$dest_table" \
                --item "$item" \
                --region eu-west-1 > /dev/null 2>&1
            ((count++))
        fi
    done <<< "$items"

    echo "    ✓ Copied $count items"
}

# Copy all tables
copy_table_data "rallye-hiver-backend-enigmas-dev" "rallye-hiver-backend-enigmas"
copy_table_data "rallye-hiver-backend-parcours-dev" "rallye-hiver-backend-parcours"
copy_table_data "rallye-hiver-backend-teams-dev" "rallye-hiver-backend-teams"
copy_table_data "rallye-hiver-backend-users-dev" "rallye-hiver-backend-users"
copy_table_data "rallye-hiver-backend-team-enigma-progress-dev" "rallye-hiver-backend-team-enigma-progress"
copy_table_data "rallye-hiver-backend-team-parcours-access-dev" "rallye-hiver-backend-team-parcours-access"
copy_table_data "rallye-hiver-backend-password-attempts-dev" "rallye-hiver-backend-password-attempts"

echo ""
echo "✓ Data migration complete"
echo ""

# Verify enigma count
ENIGMA_COUNT=$(AWS_PROFILE=claude-admin aws dynamodb scan \
    --table-name rallye-hiver-backend-enigmas \
    --select COUNT \
    --region eu-west-1 \
    --output json | jq -r '.Count')

PARCOURS_COUNT=$(AWS_PROFILE=claude-admin aws dynamodb scan \
    --table-name rallye-hiver-backend-parcours \
    --select COUNT \
    --region eu-west-1 \
    --output json | jq -r '.Count')

echo "📊 Verification:"
echo "  Enigmas: $ENIGMA_COUNT"
echo "  Parcours: $PARCOURS_COUNT"
echo ""

# Clean up dev stack (optional)
echo "🧹 Cleaning up dev stack..."
AWS_PROFILE=claude-admin npm run remove -- --stage dev || {
    echo "  ⚠️  Could not remove dev stack (may already be removed)"
}

echo ""
echo "✅ Migration Complete!"
echo ""
echo "New API Base URL: $API_ENDPOINT"
echo "Update your frontend to use this URL"
echo ""
