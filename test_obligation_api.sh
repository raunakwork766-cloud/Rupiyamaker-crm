#!/bin/bash
# Test Obligation Data Flow from Backend API to Frontend
# This script will fetch sample leads and test the obligations endpoint

echo "========================================================================"
echo "🔍 TESTING OBLIGATION DATA FLOW"
echo "========================================================================"
echo ""

# Get token and userId from a test login
echo "📋 Step 1: Getting authentication token..."

# Try to read from env or use test credentials
API_BASE="https://rupiyamaker.com:8049"

# You'll need to provide a valid token and user_id
# These can be obtained from your browser's localStorage or from a login API call

echo "⚠️  Please provide authentication details:"
echo ""
read -p "Enter your User ID: " USER_ID
read -p "Enter your Auth Token: " TOKEN

if [ -z "$USER_ID" ] || [ -z "$TOKEN" ]; then
    echo "❌ User ID and Token are required"
    exit 1
fi

echo ""
echo "✅ Authentication details provided"
echo ""

# Get list of leads
echo "📋 Step 2: Fetching leads list..."
echo ""

LEADS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/leads?user_id=${USER_ID}&page=1&limit=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Response from leads API:"
echo "$LEADS_RESPONSE" | jq -r '.items[0:3] | .[] | "\(.name) (ID: \(._id))"' 2>/dev/null || echo "$LEADS_RESPONSE"
echo ""

# Extract first lead ID
LEAD_ID=$(echo "$LEADS_RESPONSE" | jq -r '.items[0]._id // .data[0]._id // empty' 2>/dev/null)

if [ -z "$LEAD_ID" ] || [ "$LEAD_ID" == "null" ]; then
    echo "❌ Could not extract lead ID from response"
    echo "Response: $LEADS_RESPONSE"
    exit 1
fi

echo "✅ Using Lead ID: $LEAD_ID"
echo ""

# Test obligations endpoint
echo "========================================================================"
echo "📋 Step 3: Testing Obligations Endpoint"
echo "========================================================================"
echo ""
echo "Endpoint: GET ${API_BASE}/leads/${LEAD_ID}/obligations"
echo ""

OBLIGATIONS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/leads/${LEAD_ID}/obligations?user_id=${USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Raw API Response:"
echo "----------------------------------------"
echo "$OBLIGATIONS_RESPONSE" | jq . 2>/dev/null || echo "$OBLIGATIONS_RESPONSE"
echo "----------------------------------------"
echo ""

# Analyze response structure
echo "========================================================================"
echo "📊 RESPONSE ANALYSIS"
echo "========================================================================"
echo ""

# Check if response has data
if echo "$OBLIGATIONS_RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo "✅ Valid JSON response"
    
    # Check for different data structures
    HAS_DATA_KEY=$(echo "$OBLIGATIONS_RESPONSE" | jq -e '.data' >/dev/null 2>&1 && echo "YES" || echo "NO")
    HAS_OBLIGATION_DATA_KEY=$(echo "$OBLIGATIONS_RESPONSE" | jq -e '.obligation_data' >/dev/null 2>&1 && echo "YES" || echo "NO")
    HAS_ROOT_DATA=$(echo "$OBLIGATIONS_RESPONSE" | jq -e '.salary' >/dev/null 2>&1 && echo "YES" || echo "NO")
    
    echo "Data structure check:"
    echo "  - Has 'data' key: $HAS_DATA_KEY"
    echo "  - Has 'obligation_data' key: $HAS_OBLIGATION_DATA_KEY"
    echo "  - Has root-level fields: $HAS_ROOT_DATA"
    echo ""
    
    # Extract and show key fields
    echo "Key fields in response:"
    echo "$OBLIGATIONS_RESPONSE" | jq -r 'keys[] | "  - \(.)"' 2>/dev/null
    echo ""
    
    # Show field values
    echo "Field values:"
    SALARY=$(echo "$OBLIGATIONS_RESPONSE" | jq -r '.salary // .data.salary // "N/A"' 2>/dev/null)
    COMPANY=$(echo "$OBLIGATIONS_RESPONSE" | jq -r '.companyName // .data.companyName // "N/A"' 2>/dev/null)
    LOAN_REQ=$(echo "$OBLIGATIONS_RESPONSE" | jq -r '.loanRequired // .data.loanRequired // "N/A"' 2>/dev/null)
    OBLIGATIONS_COUNT=$(echo "$OBLIGATIONS_RESPONSE" | jq -r '.obligations // .data.obligations // [] | length' 2>/dev/null)
    
    echo "  - Salary: $SALARY"
    echo "  - Company Name: $COMPANY"
    echo "  - Loan Required: $LOAN_REQ"
    echo "  - Obligations Count: $OBLIGATIONS_COUNT"
    echo ""
    
    # Show obligations array if exists
    if [ "$OBLIGATIONS_COUNT" != "0" ] && [ "$OBLIGATIONS_COUNT" != "N/A" ]; then
        echo "Obligations array (first item):"
        echo "$OBLIGATIONS_RESPONSE" | jq -r '.obligations[0] // .data.obligations[0] // "N/A"' 2>/dev/null
    else
        echo "⚠️  No obligations found in response"
    fi
else
    echo "❌ Invalid JSON response or error"
    echo "$OBLIGATIONS_RESPONSE"
fi

echo ""
echo "========================================================================"
echo "✅ TEST COMPLETE"
echo "========================================================================"
echo ""
echo "Frontend expects this data structure:"
echo "  - Root level OR wrapped in 'data' OR wrapped in 'obligation_data'"
echo "  - Fields: salary, partnerSalary, yearlyBonus, companyName, etc."
echo "  - obligations: Array of obligation objects"
echo ""
echo "The frontend code handles all three structures automatically."
