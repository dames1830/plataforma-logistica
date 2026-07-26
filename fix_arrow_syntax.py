# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

# Fix single line arrow function with if statement (needs curly braces)
bad_code = "document.getElementById('m_close').onclick = () => if (modal && modal.parentNode) modal.parentNode.removeChild(modal);"
good_code = "document.getElementById('m_close').onclick = () => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); };"

if bad_code in text:
    text = text.replace(bad_code, good_code)
    print("Fixed arrow function syntax!")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
print("Saved.")
