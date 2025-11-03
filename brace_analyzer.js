// Script to analyze brace matching in LeadCRM.jsx
const fs = require('fs');

const content = fs.readFileSync('/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx', 'utf8');
const lines = content.split('\n');

let braceStack = [];
let bracketStack = [];
let parenStack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comments and strings (basic)
    let inString = false;
    let inComment = false;
    let stringChar = null;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        // Handle comments
        if (!inString && char === '/' && nextChar === '/') {
            inComment = true;
            break;
        }
        if (!inString && char === '/' && nextChar === '*') {
            inComment = true;
            j++; // skip next char
            continue;
        }
        if (inComment && char === '*' && nextChar === '/') {
            inComment = false;
            j++; // skip next char
            continue;
        }
        if (inComment) continue;
        
        // Handle strings
        if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
            continue;
        }
        if (inString && char === stringChar && line[j-1] !== '\\') {
            inString = false;
            stringChar = null;
            continue;
        }
        if (inString) continue;
        
        // Count brackets
        if (char === '{') {
            braceStack.push({ line: lineNum, col: j });
        } else if (char === '}') {
            if (braceStack.length === 0) {
                console.log(`Extra closing brace } at line ${lineNum}:${j}`);
            } else {
                braceStack.pop();
            }
        } else if (char === '(') {
            parenStack.push({ line: lineNum, col: j });
        } else if (char === ')') {
            if (parenStack.length === 0) {
                console.log(`Extra closing paren ) at line ${lineNum}:${j}`);
            } else {
                parenStack.pop();
            }
        } else if (char === '[') {
            bracketStack.push({ line: lineNum, col: j });
        } else if (char === ']') {
            if (bracketStack.length === 0) {
                console.log(`Extra closing bracket ] at line ${lineNum}:${j}`);
            } else {
                bracketStack.pop();
            }
        }
    }
}

console.log(`\nUnclosed braces { : ${braceStack.length}`);
braceStack.forEach(b => console.log(`  Line ${b.line}:${b.col}`));

console.log(`\nUnclosed parens ( : ${parenStack.length}`);
parenStack.forEach(p => console.log(`  Line ${p.line}:${p.col}`));

console.log(`\nUnclosed brackets [ : ${bracketStack.length}`);
bracketStack.forEach(b => console.log(`  Line ${b.line}:${b.col}`));
