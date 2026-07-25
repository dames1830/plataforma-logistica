with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("RENDIMIENTO DE OPERARIOS (ANCHO")
if idx != -1:
    print(text[max(0, idx - 300) : min(len(text), idx + 300)])
