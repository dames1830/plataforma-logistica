import io

with io.open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("|| raw[14] ||", "|| raw[13] || raw[14] ||")
content = content.replace(
    "if (name === 'IDX14') return String(raw[14] || '');",
    "if (name === 'IDX13') return String(raw[13] || '');\n              if (name === 'IDX14') return String(raw[14] || '');"
)
content = content.replace(
    "['TEMPORADA', 'SEASON', 'IDX14', 'IDX2']",
    "['TEMPORADA', 'SEASON', 'IDX13', 'IDX14', 'IDX2']"
)

with io.open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(content)
