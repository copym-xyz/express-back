#!/bin/bash
# Test script for Sumsub API endpoints

echo "Testing Sumsub API endpoints..."
echo "============================"

# Base URL
BASE_URL="http://localhost:5000/api"

# Test 1: Basic server health check
echo "Test 1: Basic server health check"
curl -s $BASE_URL/test
echo -e "\n"

# Test 2: Get Sumsub access token
echo "Test 2: Get Sumsub access token"
curl -s -X GET "$BASE_URL/sumsub/token?userId=test-user-$(date +%s)"
echo -e "\n"

# Test 3: Get Sumsub access token (POST)
echo "Test 3: Get Sumsub access token (POST)"
curl -s -X POST "$BASE_URL/sumsub/token" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-'$(date +%s)'", "levelName":"basic-kyc-level"}'
echo -e "\n"

# Test 4: Sumsub Health Check
echo "Test 4: Sumsub API Health Check"
curl -s $BASE_URL/sumsub/health-check
echo -e "\n"

echo "Tests completed!" 