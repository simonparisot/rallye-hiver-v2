#!/bin/bash

# Rallye Hiver Functional Tests Runner
# This script runs all functional tests for the application

set -e

echo "========================================="
echo " Rallye Hiver Functional Tests"
echo "========================================="
echo ""

# Change to tests directory
cd "$(dirname "$0")/tests"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing test dependencies..."
    npm install
    echo ""
fi

# Run tests
echo "🧪 Running functional tests..."
echo ""
npm test

echo ""
echo "========================================="
echo " ✅ All tests completed!"
echo "========================================="
