#!/bin/bash
# Test the new /process endpoint

echo "=========================================="
echo "Testing How To Process Section Fix"
echo "=========================================="
echo ""

# Test if backend is running
echo "1. Checking if backend is running on port 8049..."
if lsof -i :8049 > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is NOT running"
    exit 1
fi
echo ""

# You'll need valid credentials for actual testing
echo "2. To test the new /process endpoint, you need:"
echo "   - A valid lead ID"
echo "   - A valid user ID"
echo "   - A valid auth token"
echo ""
echo "Example curl command:"
echo ""
echo "curl -X POST 'http://localhost:8049/api/leads/{LEAD_ID}/process?user_id={USER_ID}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer {TOKEN}' \\"
echo "  -d '{\"purpose_of_loan\": \"BUSINESS EXPANSION\"}'"
echo ""
echo "=========================================="
echo "Manual Testing Steps:"
echo "=========================================="
echo ""
echo "1. Open CRM in browser"
echo "2. Open any lead"
echo "3. Go to Obligations tab → Enter some data → Save"
echo "4. Go to How to Process tab → Update any field"
echo "5. Go back to Obligations tab"
echo "6. ✅ VERIFY: Obligation data is still there"
echo ""
echo "Expected console output:"
echo "  '📡 Using /process endpoint'"
echo "  '✅ Obligation data preserved!'"
echo ""

# Check if the endpoint exists by looking at the routes file
echo "=========================================="
echo "Verifying endpoint code exists:"
echo "=========================================="
if grep -q "@router.post.*process" /www/wwwroot/RupiyaMe/backend/app/routes/leads.py; then
    echo "✅ /process endpoint found in leads.py"
else
    echo "❌ /process endpoint NOT found in leads.py"
fi

if grep -q "@router.post.*process" /www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py; then
    echo "✅ /process endpoint found in leadLoginRelated.py"
else
    echo "❌ /process endpoint NOT found in leadLoginRelated.py"
fi
echo ""

echo "=========================================="
echo "Frontend verification:"
echo "=========================================="
if grep -q "/process?user_id=" /www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/sections/HowToProcessSection.jsx; then
    echo "✅ Frontend updated to use /process endpoint"
else
    echo "❌ Frontend NOT updated"
fi
echo ""

echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Rebuild frontend: cd /www/wwwroot/RupiyaMe/rupiyamaker-UI/crm && npm run build"
echo "2. Test in browser as described above"
echo "3. Check browser console for '✅ Obligation data preserved!'"
echo ""
