// Simple brace checker
const fs = require('fs');
const content = fs.readFileSync('/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx', 'utf8');

let braceCount = 0;
let parenCount = 0;
let inJSX = false;
let jsxDepth = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    // Track JSX
    if (char === '<' && content.slice(i, i + 6) === 'return' === false) {
        if (nextChar && nextChar.match(/[a-zA-Z]/)) {
            jsxDepth++;
            inJSX = true;
        } else if (nextChar === '/') {
            jsxDepth--;
            if (jsxDepth === 0) inJSX = false;
        }
    }
    
    if (!inJSX) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
    }
}

console.log('Final brace count:', braceCount);
console.log('Final paren count:', parenCount);

if (braceCount !== 0) {
    console.log('Missing', Math.abs(braceCount), braceCount > 0 ? 'closing braces }' : 'opening braces {');
}
if (parenCount !== 0) {
    console.log('Missing', Math.abs(parenCount), parenCount > 0 ? 'closing parens )' : 'opening parens (');
}