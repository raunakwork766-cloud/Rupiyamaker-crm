// Temporary debug script to add debugging to duplicate filter
const fs = require('fs');
const path = '/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx';

let content = fs.readFileSync(path, 'utf8');

// Find first occurrence of duplicate filter and add debug
const firstOccurrenceRegex = /(\/\/ File sent to login date range filter[\s\S]*?})[\s\S]*?(\/\/ Check duplicate leads filter\s+if \(filterOptions\.checkDuplicateLeads\) \{)/;

const replacement = `$1
        
        // Check duplicate leads filter - FIRST OCCURRENCE DEBUG
        console.log('FIRST: Checking duplicate filter:', filterOptions.checkDuplicateLeads);
        if (filterOptions.checkDuplicateLeads) {`;

content = content.replace(firstOccurrenceRegex, replacement);

fs.writeFileSync(path, content);
console.log('Debug code added successfully');