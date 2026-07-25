const fs = require('fs');
let text = fs.readFileSync('js/views/dashboard_v24.js', 'utf8');

const target =             container.innerHTML = <div style="padding:4rem; color:red; text-align:center;">
                <h2 style="font-size:2rem; margin-bottom:1rem;">ERROR CRITICO EN LAYOUT</h2>
                <p style="font-size:1.2rem; margin-bottom:1rem;"></p>
                <pre style="text-align:left; background:rgba(0,0,0,0.5); padding:1rem; border-radius:8px; overflow-x:auto;"></pre>
            </div>;;

const replacement =             container.innerHTML = \<div style="padding:4rem; color:red; text-align:center;">
                <h2 style="font-size:2rem; margin-bottom:1rem;">ERROR CRITICO EN LAYOUT</h2>
                <p style="font-size:1.2rem; margin-bottom:1rem;">\</p>
                <pre style="text-align:left; background:rgba(0,0,0,0.5); padding:1rem; border-radius:8px; overflow-x:auto;">\</pre>
            </div>\;;

// Account for possible \r\n differences in reading
const targetRegex = /container\.innerHTML = <div[\s\S]*?<\/div>;/m;
text = text.replace(targetRegex, replacement);

fs.writeFileSync('js/views/dashboard_v24.js', text, 'utf8');
