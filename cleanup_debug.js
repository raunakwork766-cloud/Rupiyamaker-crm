// Remove debug code and fix structure
const fs = require('fs');
let content = fs.readFileSync('/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx', 'utf8');

// Remove debug code
content = content.replace(/console\.log\('Duplicate filter checkbox clicked:', e\.target\.checked\);[\s\S]*?/g, '');
content = content.replace(/console\.log\('filteredLeadsData recalculating.*?\);[\s\S]*?/g, '');
content = content.replace(/\/\/ Check duplicate leads filter - FIRST OCCURRENCE DEBUG[\s\S]*?console\.log\('FIRST: Checking duplicate filter:', filterOptions\.checkDuplicateLeads\);[\s\S]*?/g, '// Check duplicate leads filter\n        ');
content = content.replace(/console\.log\('FIRST:.*?\);[\s\S]*?/g, '');

// Fix the ending structure
content = content.replace(/\s*\}\s*\)\s*;\s*\}\)\s*;\s*export default LeadCRM;/, `
    );
});

export default LeadCRM;`);

fs.writeFileSync('/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx', content);
console.log('Debug code removed and structure fixed');