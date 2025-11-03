// Add more detailed debugging to duplicate filter logic
const fs = require('fs');
const path = '/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx';

let content = fs.readFileSync(path, 'utf8');

// Add debug to the duplicate filtering logic
const debugReplace = content.replace(
  /(\/\/ Check duplicate leads filter - FIRST OCCURRENCE DEBUG[\s\S]*?console\.log\('FIRST: Checking duplicate filter:', filterOptions\.checkDuplicateLeads\);[\s\S]*?if \(filterOptions\.checkDuplicateLeads\) \{[\s\S]*?)(\/\/ Create a map to track phone numbers and their occurrences)/,
  `$1
            console.log('FIRST: Duplicate filter is active, filtering', filtered.length, 'leads');
            
            $2`
);

content = debugReplace.replace(
  /(\/\/ Second pass: filter leads that have duplicates[\s\S]*?)(filtered = filtered\.filter\(lead => \{)/,
  `$1
            console.log('FIRST: About to filter for duplicates, phoneMap has', phoneMap.size, 'unique numbers');
            const duplicatePhones = Array.from(phoneMap.entries()).filter(([phone, leads]) => leads.length > 1);
            console.log('FIRST: Found', duplicatePhones.length, 'phone numbers with duplicates');
            
            const beforeCount = filtered.length;
            $2`
);

content = debugReplace.replace(
  /(return phoneStr\.length > 0 && phoneMap\.has\(phoneStr\) && phoneMap\.get\(phoneStr\)\.length > 1;[\s\S]*?}\);[\s\S]*?}\);[\s\S]*?})/,
  `return phoneStr.length > 0 && phoneMap.has(phoneStr) && phoneMap.get(phoneStr).length > 1;
                });
            });
            
            console.log('FIRST: Duplicate filter complete:', beforeCount, '→', filtered.length, 'leads');
        }`
);

fs.writeFileSync(path, content);
console.log('Additional debug code added successfully');