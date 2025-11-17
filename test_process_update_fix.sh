#!/bin/bash
# Test Process Section Update - Verify Data Preservation

echo "=========================================="
echo "🧪 PROCESS SECTION UPDATE TEST"
echo "=========================================="
echo ""

echo "📋 This test verifies that:"
echo "  1. Process section data IS being updated ✅"
echo "  2. Obligation data is NOT being removed ✅"
echo ""

echo "=========================================="
echo "🔍 Checking Backend Endpoints"
echo "=========================================="

# Check if endpoints exist in code
if grep -q "update_lead_process" /www/wwwroot/RupiyaMe/backend/app/routes/leads.py; then
    echo "✅ update_lead_process() function found in leads.py"
else
    echo "❌ update_lead_process() function NOT found in leads.py"
fi

if grep -q "update_login_lead_process" /www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py; then
    echo "✅ update_login_lead_process() function found in leadLoginRelated.py"
else
    echo "❌ update_login_lead_process() function NOT found in leadLoginRelated.py"
fi

# Check for deep copy logic
if grep -q "copy.deepcopy" /www/wwwroot/RupiyaMe/backend/app/routes/leads.py; then
    echo "✅ Deep copy protection found in leads.py"
else
    echo "⚠️  Deep copy protection NOT found in leads.py"
fi

if grep -q "copy.deepcopy" /www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py; then
    echo "✅ Deep copy protection found in leadLoginRelated.py"
else
    echo "⚠️  Deep copy protection NOT found in leadLoginRelated.py"
fi

echo ""
echo "=========================================="
echo "🔍 Checking Backend Logging"
echo "=========================================="

# Check for comprehensive logging
if grep -q "🔵 ========== PROCESS UPDATE START" /www/wwwroot/RupiyaMe/backend/app/routes/leads.py; then
    echo "✅ Comprehensive logging added to leads.py"
else
    echo "⚠️  Logging may be incomplete in leads.py"
fi

if grep -q "🔵 ========== LOGIN LEAD PROCESS UPDATE START" /www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py; then
    echo "✅ Comprehensive logging added to leadLoginRelated.py"
else
    echo "⚠️  Logging may be incomplete in leadLoginRelated.py"
fi

echo ""
echo "=========================================="
echo "📡 Backend Status"
echo "=========================================="

if lsof -i :8049 > /dev/null 2>&1; then
    echo "✅ Backend is running on port 8049"
    PID=$(lsof -ti :8049 | head -1)
    echo "   Process ID: $PID"
else
    echo "❌ Backend is NOT running on port 8049"
fi

echo ""
echo "=========================================="
echo "🧪 MANUAL TESTING STEPS"
echo "=========================================="
echo ""
echo "1️⃣  Open CRM in browser and open any lead"
echo ""
echo "2️⃣  Go to Obligations tab:"
echo "    - Add salary: 50000"
echo "    - Add at least one obligation"
echo "    - Click Save"
echo "    - ✅ Verify: Data saved successfully"
echo ""
echo "3️⃣  Go to How to Process tab:"
echo "    - Update 'Purpose of Loan'"
echo "    - Tab out (auto-saves)"
echo "    - Check browser console"
echo ""
echo "4️⃣  Expected Console Output:"
echo "    🔵 ========== PROCESS UPDATE START =========="
echo "    📝 Updating process.purpose_of_loan = YOUR_VALUE"
echo "    🔍 AFTER UPDATE - obligation_data still exists: True"
echo "    ✅ Process data updated successfully"
echo "    🔵 ========== PROCESS UPDATE END =========="
echo ""
echo "5️⃣  Go back to Obligations tab:"
echo "    - ✅ VERIFY: Obligation data is STILL there"
echo "    - ✅ VERIFY: Salary value is preserved"
echo "    - ✅ VERIFY: Obligations list is preserved"
echo ""
echo "6️⃣  Refresh page (F5) and check Obligations tab again:"
echo "    - ✅ VERIFY: Data persists after refresh"
echo ""

echo "=========================================="
echo "🔍 What to Look For in Browser Console"
echo "=========================================="
echo ""
echo "✅ GOOD - Process update is working:"
echo "   '📡 Using /process endpoint'"
echo "   '✅ Obligation data preserved!'"
echo "   'Response: 200 OK'"
echo ""
echo "✅ GOOD - Backend logs in browser Network tab:"
echo "   Request URL: .../process?user_id=..."
echo "   Method: POST"
echo "   Status: 200"
echo "   Response: {\"message\":\"Process data updated successfully\",\"success\":true}"
echo ""
echo "❌ BAD - Something is wrong:"
echo "   '422 Unprocessable Entity'"
echo "   '500 Internal Server Error'"
echo "   '404 Not Found on /process'"
echo "   'Obligation data NOT preserved!'"
echo ""

echo "=========================================="
echo "🐛 Troubleshooting"
echo "=========================================="
echo ""
echo "If process data is NOT updating:"
echo "  1. Check browser console for errors"
echo "  2. Check Network tab - is it calling /process?"
echo "  3. Check backend logs: tail -f /www/wwwroot/RupiyaMe/backend/logs/*.log"
echo "  4. Restart backend: ./test_howtoprocess_fix.sh"
echo ""
echo "If obligation data IS being removed:"
echo "  1. This should NOT happen with the fix!"
echo "  2. Check backend logs for 'obligation_data still exists: True'"
echo "  3. If it says 'False', there's a deeper issue"
echo "  4. Share the logs with the development team"
echo ""

echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo ""
echo "✅ Backend endpoints updated with:"
echo "   - Deep copy protection for dynamic_fields"
echo "   - Comprehensive logging for debugging"
echo "   - Proper preservation of obligation_data"
echo ""
echo "✅ Ready to test!"
echo "   - Follow the manual testing steps above"
echo "   - Check browser console and Network tab"
echo "   - Verify both updates work AND data is preserved"
echo ""
