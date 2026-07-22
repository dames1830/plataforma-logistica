import io

with io.open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("REPORTE ${zonaLabel} - BATA", "REPORTE ${zonaLabel} - ${brandTitle}")

with io.open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(content)
