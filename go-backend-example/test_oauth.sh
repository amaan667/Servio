#!/bin/bash

# Test script for OAuth JSON structure fix
echo "Testing OAuth JSON Structure Fix"
echo "================================="

# Test 1: Valid flat JSON structure (should work)
echo "Test 1: Valid flat JSON structure"
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"code":"test_auth_code_123","verifier":"test_verifier_456"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n"

# Test 2: Missing code (should return 400)
echo "Test 2: Missing code"
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"verifier":"test_verifier_456"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n"

# Test 3: Missing verifier (should return 400)
echo "Test 3: Missing verifier"
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"code":"test_auth_code_123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n"

# Test 4: Empty JSON (should return 400)
echo "Test 4: Empty JSON"
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n"

# Test 5: Invalid JSON (should return 400)
echo "Test 5: Invalid JSON"
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{invalid json}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n"
echo "Test completed. Check the Go backend logs for detailed information."