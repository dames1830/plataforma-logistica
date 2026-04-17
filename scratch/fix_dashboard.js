const fs = require('fs');
const path = 'C:\\Users\\dames\\.gemini\\antigravity\\scratch\\logistics-web-app\\js\\views\\dashboard.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic line is around line 831. 
// We want to replace: onmouseout="this.style.background='${isAllowed ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)}'"}
// with: onmouseout="this.style.background='${isAllowed ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)}'}">

const oldStr = `onmouseout="this.style.background='${'${isAllowed ? \'rgba(34,197,94,0.08)\' : \'rgba(255,255,255,0.02)\'}'}'"`;
const newStr = `onmouseout="this.style.background='${'${isAllowed ? \'rgba(34,197,94,0.08)\' : \'rgba(255,255,255,0.02)\'}'}'">`;

// Try a broader replacement if the exact one fails
const regex = /onmouseout="this\.style\.background='\$\{isAllowed\s\?\s'rgba\(34,197,94,0\.08\)'\s:\s'rgba\(255,255,255,0\.02\)'\}"(?!\s*>)/;
const fixedContent = content.replace(regex, (match) => match + '>');

if (content !== fixedContent) {
    fs.writeFileSync(path, fixedContent, 'utf8');
    console.log('Successfully fixed the missing tag bracket.');
} else {
    // Try even broader
    const regex2 = /rgba\(255,255,255,0\.02\)'\}"/g;
    const fixedContent2 = content.replace(regex2, (match) => match + '>');
    if (content !== fixedContent2) {
        fs.writeFileSync(path, fixedContent2, 'utf8');
        console.log('Successfully fixed using secondary regex.');
    } else {
        console.error('Could not find the problematic string to fix.');
        // Last resort: find the label line and fix it
        const lines = content.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('onmouseout') && lines[i].includes('label') && !lines[i].trim().endsWith('>')) {
                lines[i] = lines[i].trimEnd() + '>';
                found = true;
            }
        }
        if (found) {
            fs.writeFileSync(path, lines.join('\n'), 'utf8');
            console.log('Fixed using line iteration.');
        } else {
             console.error('Line iteration failed too.');
        }
    }
}
