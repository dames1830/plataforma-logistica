
const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\dames\\.gemini\\antigravity\\scratch\\logistics-web-app\\beta\\js\\views\\dashboard_v6.js', 'utf8');

let braces = 0;
let parens = 0;
let brackets = 0;
let inString = false;
let stringChar = '';
let isEscaped = false;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (isEscaped) {
        isEscaped = false;
        continue;
    }
    if (char === '\\') {
        isEscaped = true;
        continue;
    }
    if (inString) {
        if (char === stringChar) {
            inString = false;
        }
        continue;
    }
    if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
    }
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '(') parens++;
    if (char === ')') parens--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
}

console.log('Braces:', braces);
console.log('Parens:', parens);
console.log('Brackets:', brackets);
console.log('In string:', inString);
