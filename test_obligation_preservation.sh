#!/bin/bash

echo "=========================================="
echo "TESTING OBLIGATION DATA PRESERVATION"
echo "=========================================="

# You need to provide a real lead ID from your database
LEAD_ID="YOUR_LEAD_ID_HERE"
USER_ID="YOUR_USER_ID_HERE"

echo ""
echo "Step 1: Check current lead data..."
curl -s "http://localhost:8049/leads/${LEAD_ID}?user_id=${USER_ID}" | python3 -m json.tool | grep -A 5 "obligation_data"

echo ""
echo "Step 2: Update process field (processing_bank)..."
curl -X PUT "http://localhost:8049/leads/${LEAD_ID}?user_id=${USER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "dynamic_fields": {
      "process": {
        "processing_bank": "HDFC Bank TEST"
      }
    }
  }'

echo ""
echo ""
echo "Step 3: Verify obligation_data is still there..."
curl -s "http://localhost:8049/leads/${LEAD_ID}?user_id=${USER_ID}" | python3 -m json.tool | grep -A 5 "obligation_data"

echo ""
echo "=========================================="
echo "Check the backend logs at: /tmp/backend_deepcopy_fix.log"
echo "Look for: '✅✅ obligation_data CONFIRMED'"
echo "=========================================="
