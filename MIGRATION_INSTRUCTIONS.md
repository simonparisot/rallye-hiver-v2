# Single Environment Migration Instructions

## What Changed

The backend has been reconfigured to use a **single production environment** without dev/prod separation:

- All resources now use `prod` stage
- No `-dev` or `-prod` suffixes on resource names
- Single API endpoint (no /dev prefix in paths, but /prod is required by AWS)
- Simplified deployment process

## Migration Steps

### Step 1: Refresh AWS Credentials

```bash
aws sso login --profile claude-admin
```

This will open your browser for authentication.

### Step 2: Run the Migration Script

```bash
cd backend
./migrate-to-single-env.sh
```

This script will:
1. Deploy the updated backend configuration
2. Copy all data from dev tables to prod tables (20 enigmas, 10 parcours, users, teams)
3. Clean up the old dev stack
4. Display the new API endpoint

### Step 3: Update Frontend

After migration, update your frontend configuration to use the new API base URL:

The URL will be shown at the end of the migration script, something like:
```
https://{api-id}.execute-api.eu-west-1.amazonaws.com/prod
```

## Manual Migration (if script fails)

If the script fails, you can run these commands manually:

```bash
# 1. Deploy
cd backend
AWS_PROFILE=claude-admin npm run deploy

# 2. Get new endpoint
AWS_PROFILE=claude-admin aws cloudformation describe-stacks \
  --stack-name rallye-hiver-backend-prod \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceEndpoint`].OutputValue' \
  --output text

# 3. Copy enigmas
# (repeat for each table: enigmas, parcours, teams, users, etc.)
AWS_PROFILE=claude-admin aws dynamodb scan \
  --table-name rallye-hiver-backend-enigmas-dev \
  --region eu-west-1 \
  --output json | \
jq -c '.Items[]' | \
while read item; do
  echo "$item" | \
  AWS_PROFILE=claude-admin aws dynamodb put-item \
    --table-name rallye-hiver-backend-enigmas \
    --item file:///dev/stdin \
    --region eu-west-1
done
```

## What to Expect

- **API URL**: Will change from `/dev/` to `/prod/`
- **Your Data**: All users, teams, enigmas will be preserved
- **Cognito**: Your existing user (parisot.simon@gmail.com) will work
- **S3**: Enigma PDFs remain the same (already in production bucket)

## Verification

After migration, verify:

```bash
# Check enigma count
AWS_PROFILE=claude-admin aws dynamodb scan \
  --table-name rallye-hiver-backend-enigmas \
  --select COUNT \
  --region eu-west-1

# Test signup with your email
curl -X POST https://{api-id}.execute-api.eu-west-1.amazonaws.com/prod/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"Test123456","displayName":"Test"}'
```

## Rollback (if needed)

If something goes wrong:

```bash
# The dev stack still exists and can be used
# Just change serverless.yml back to stage: dev
```
