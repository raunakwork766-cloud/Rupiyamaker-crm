const fs = require('fs');

try {
  const content = fs.readFileSync('/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/pages/NotificationManagementPage.jsx', 'utf8');
  
  // Count opening and closing div tags
  const openingDivs = (content.match(/<div\s/g) || []).length;
  const closingDivs = (content.match(/<\/div>/g) || []).length;
  
  console.log(`Opening div tags: ${openingDivs}`);
  console.log(`Closing div tags: ${closingDivs}`);
  console.log(`Difference: ${openingDivs - closingDivs}`);
  
  // Check for unclosed JSX elements
  let openTags = [];
  let lineNum = 1;
  const lines = content.split('\n');
  
  for (let line of lines) {
    // Simple check for opening tags
    const openMatches = line.match(/<([a-zA-Z][a-zA-Z0-9]*)\s/g);
    const closeMatches = line.match(/<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g);
    const selfClosing = line.match(/<[a-zA-Z][a-zA-Z0-9]*[^>]*\/>/g);
    
    if (openMatches) {
      openMatches.forEach(match => {
        const tag = match.match(/<([a-zA-Z][a-zA-Z0-9]*)/)[1];
        if (!selfClosing || !selfClosing.some(sc => sc.includes(tag))) {
          openTags.push({ tag, line: lineNum });
        }
      });
    }
    
    if (closeMatches) {
      closeMatches.forEach(match => {
        const tag = match.match(/<\/([a-zA-Z][a-zA-Z0-9]*)/)[1];
        // Find and remove the last occurrence of this tag
        for (let i = openTags.length - 1; i >= 0; i--) {
          if (openTags[i].tag === tag) {
            openTags.splice(i, 1);
            break;
          }
        }
      });
    }
    
    lineNum++;
  }
  
  if (openTags.length > 0) {
    console.log('\nUnclosed tags:');
    openTags.forEach(tag => {
      console.log(`  <${tag.tag}> at line ${tag.line}`);
    });
  } else {
    console.log('\nAll tags appear to be balanced');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}