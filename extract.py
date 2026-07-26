import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash = f.read()

m_hourly = re.search(r'const renderHourlyProductionReport = \(tasksList\) => \{(.*?)\s*};\s*\n\s*// ====', dash, re.DOTALL)
hourly = m_hourly.group(1) if m_hourly else 'console.error("hourly not found");'

m_weekly = re.search(r'const renderWeeklyStorageReport = \(tasksList\) => \{(.*?)\s*};\s*\n\s*// ====', dash, re.DOTALL)
weekly = m_weekly.group(1) if m_weekly else 'console.error("weekly not found");'

m_chart = re.search(r'const renderWeeklyDailyChartSection = \(tasksList\) => \{(.*?)\s*};\s*\n\s*// Pre-calcular', dash, re.DOTALL)
chart = m_chart.group(1) if m_chart else 'console.error("chart not found");'

# Use exact boundaries
m_marcas = re.search(r'<!-- REPORTE ALMACENAJE - MARCAS \(IZQUIERDA\) -->(.*?)<!-- REPORTE ALMACENAJE - GENDER RIMS \(DERECHA\) -->', dash, re.DOTALL)
marcas = m_marcas.group(1).strip() if m_marcas else 'console.error("marcas not found");'

m_operarios = re.search(r'<!-- REPORTE RENDIMIENTO DE OPERARIOS \(ANCHO COMPLETO\) -->(.*?)\$\{renderHourlyProductionReport', dash, re.DOTALL)
operarios = m_operarios.group(1).strip() if m_operarios else 'console.error("operarios not found");'

with open('extracted_blocks.py', 'w', encoding='utf-8') as f:
    f.write('hourly = """' + hourly.replace('"""', '') + '"""\n')
    f.write('weekly = """' + weekly.replace('"""', '') + '"""\n')
    f.write('chart = """' + chart.replace('"""', '') + '"""\n')
    f.write('marcas = """' + marcas.replace('"""', '') + '"""\n')
    f.write('operarios = """' + operarios.replace('"""', '') + '"""\n')

print('Extraction completed.')
