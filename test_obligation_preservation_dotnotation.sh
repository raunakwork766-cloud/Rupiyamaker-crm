#!/bin/bash

# Test script to verify obligation_data is preserved when updating process fields
# This tests the MongoDB dot notation fix

echo "=========================================="
echo "🧪 OBLIGATION DATA PRESERVATION TEST"
echo "   MongoDB Dot Notation Fix Verification"
echo "=========================================="
echo ""

# Get test lead ID
read -p "Enter Lead ID to test: " LEAD_ID
read -p "Enter your auth token: " AUTH_TOKEN

echo ""
echo "Step 1: Getting current lead data..."
CURRENT_DATA=$(curl -s -X GET "https://localhost:8049/api/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -k)

echo "✅ Current lead retrieved"
echo ""

# Check if obligation_data exists
OBLIGATION_EXISTS=$(echo "$CURRENT_DATA" | grep -o '"obligation_data"' | head -1)
PROCESS_EXISTS=$(echo "$CURRENT_DATA" | grep -o '"process"' | head -1)

echo "Current state:"
if [ ! -z "$OBLIGATION_EXISTS" ]; then
    echo "  ✅ obligation_data EXISTS in lead"
    OBLIGATION_COUNT=$(echo "$CURRENT_DATA" | grep -o '"obligation_data":{[^}]*}' | wc -c)
    echo "     Size: ~$OBLIGATION_COUNT bytes"
else
    echo "  ⚠️ obligation_data DOES NOT EXIST"
    echo "     Please add some data in the Application Section tab first!"
    exit 1
fi

if [ ! -z "$PROCESS_EXISTS" ]; then
    echo "  ✅ process EXISTS in lead"
else
    echo "  ⚠️ process DOES NOT EXIST (will be created)"
fi

echo ""
echo "Step 2: Updating process field (how_to_process)..."
echo "  📝 Setting: how_to_process = 'TEST UPDATE - $(date +%H:%M:%S)'"

UPDATE_PAYLOAD='{
  "dynamic_fields": {
    "process": {
      "how_to_process": "TEST UPDATE - '"$(date +%H:%M:%S)"'"
    }
  }
}'

echo ""
echo "Payload being sent:"
echo "$UPDATE_PAYLOAD"
echo ""

UPDATE_RESPONSE=$(curl -s -X PUT "https://localhost:8049/api/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -k \
  -d "$UPDATE_PAYLOAD")

echo "✅ Update request sent"
echo ""

sleep 2

echo "Step 3: Retrieving updated lead data..."
UPDATED_DATA=$(curl -s -X GET "https://localhost:8049/api/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -k)

echo "✅ Updated lead retrieved"
echo ""

# Check obligation_data after update
OBLIGATION_AFTER=$(echo "$UPDATED_DATA" | grep -o '"obligation_data"' | head -1)
PROCESS_AFTER=$(echo "$UPDATED_DATA" | grep -o '"how_to_process":"TEST UPDATE' | head -1)

echo "=========================================="
echo "📊 TEST RESULTS"
echo "=========================================="

if [ ! -z "$PROCESS_AFTER" ]; then
    echo "✅ PASS: process.how_to_process was updated successfully"
else
    echo "❌ FAIL: process.how_to_process was NOT updated"
fi

if [ ! -z "$OBLIGATION_AFTER" ]; then
    echo "✅ PASS: obligation_data PRESERVED after process update"
    OBLIGATION_AFTER_COUNT=$(echo "$UPDATED_DATA" | grep -o '"obligation_data":{[^}]*}' | wc -c)
    echo "         Size after: ~$OBLIGATION_AFTER_COUNT bytes"
else
    echo "❌ FAIL: obligation_data was DELETED during process update"
fi

echo ""
echo "=========================================="
echo "📋 Backend Logs (Dot Notation)"
echo "=========================================="
tail -50 /tmp/backend_dot_notation_fix.log | grep -E "🔧 MongoDB dot notation|obligation_data|PRESERVED"

echo ""
echo "=========================================="
echo "🏁 Test Complete"
echo "=========================================="
