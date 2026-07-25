import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

replacement = """container.innerHTML = `<div style="padding:4rem; color:red; text-align:center;">
                <h2 style="font-size:2rem; margin-bottom:1rem;">ERROR CRITICO EN LAYOUT</h2>
                <p style="font-size:1.2rem; margin-bottom:1rem;">${e.message}</p>
                <pre style="text-align:left; background:rgba(0,0,0,0.5); padding:1rem; border-radius:8px; overflow-x:auto;">${e.stack}</pre>
            </div>`;"""

text = re.sub(r'container\.innerHTML = <div[\s\S]*?</div>;', replacement, text)

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(text)
