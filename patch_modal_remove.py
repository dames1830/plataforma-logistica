# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    "modal.querySelector('#btnCloseModal').onclick = () => document.body.removeChild(modal);",
    "modal.querySelector('#btnCloseModal').onclick = () => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); };"
)

text = text.replace(
    "document.body.removeChild(modal);",
    "if (modal && modal.parentNode) modal.parentNode.removeChild(modal);"
)

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
print("Safe modal remove patched.")
