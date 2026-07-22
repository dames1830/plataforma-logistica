import io

with io.open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("          targetContainer.innerHTML = `", "          const brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : 'BATA';\n          targetContainer.innerHTML = `")

with io.open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(content)
