import fs from 'fs';

// Look at the ALL_AGENTS data in src/data.js
const content = fs.readFileSync('/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/data.js', 'utf8');

const regex = /\{([^}]+)\}/g;
let match;
const agents = [];

let agentLines = content.split('\n').filter(line => line.includes('date:'));
console.log(agentLines[0]);
