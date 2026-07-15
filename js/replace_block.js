const fs = require('fs');

const file = 'C:/Users/dames/.gemini/antigravity/scratch/logistics-web-app/js/views/dashboard_v24.js';
let content = fs.readFileSync(file, 'utf8');

const newBlock = fs.readFileSync('C:/Users/dames/.gemini/antigravity/scratch/logistics-web-app/js/fix_layout.js', 'utf8');

const startTag = '  const renderLayoutActivo = (container) => {';
const endTag = '        let gridHtml = `';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag, startIndex);

if (startIndex >= 0 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    
    fs.writeFileSync(file, before + newBlock + '\n\n' + after, 'utf8');
    console.log('Replaced successfully.');
} else {
    console.log('Bounds not found.');
}
