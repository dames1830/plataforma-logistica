import os
import re

files = ['js/views/dashboard_v24.js', 'js/views/dashboard_v6.js']

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # 1. Rename STOCK GENERAL to STOCK ACTIVO in archivo_inventario
    content = content.replace("'inventario', stock, '.csv', 'STOCK GENERAL'", "'inventario', stock, '.csv', 'STOCK ACTIVO'")
    
    # 2. Add MAESTRO ARTICULOS to archivo_inventario
    # Find: renderUploadArea(wrap, 'inventario', stock, '.csv', 'STOCK ACTIVO');
    target1 = "renderUploadArea(wrap, 'inventario', stock, '.csv', 'STOCK ACTIVO');"
    if target1 in content and "'articulos', articulos, '.xlsx', 'MAESTRO ARTÍCULOS'" not in content.split(target1)[1][:150]:
        content = content.replace(target1, target1 + "\n       renderUploadArea(wrap, 'articulos', articulos, '.xlsx', 'MAESTRO ARTÍCULOS');")
    
    # Also update the Promise.all for articulos
    promise_target = """       const [matriz, reserva, stock] = await Promise.all([
           getAreaData('matriz_ubicaciones'),
           getAreaData('stockReserva'),
           getAreaData('inventario')
       ]);"""
    promise_replace = """       const [matriz, reserva, stock, articulos] = await Promise.all([
           getAreaData('matriz_ubicaciones'),
           getAreaData('stockReserva'),
           getAreaData('inventario'),
           getAreaData('articulos')
       ]);"""
    content = content.replace(promise_target, promise_replace)
    
    # 3. Remove MAESTRO ARTICULOS from inventarios -> general
    target3_regex = re.compile(r"renderUploadArea\(wrap,\s*'articulos',\s*articulos,\s*'\.xlsx',\s*'MAESTRO ARTÍCULOS'\);\s*// Agregamos info visual de que se nutre de Archivo Inventario\s*wrap\.innerHTML \+= `<div style=[^>]+>ℹ️ Este módulo utiliza automáticamente la Matriz y Stock cargados en 'ARCHIVO INVENTARIO'\.<\/div>`;")
    
    replacement3 = """// Agregamos info visual de que se nutre de Archivo Inventario
        wrap.innerHTML += `<div style="margin-top:1rem; padding:0.8rem; background:rgba(129, 140, 248, 0.05); border-radius:8px; border:1px dashed rgba(129, 140, 248, 0.2); font-size:0.7rem; color:#818cf8; text-align:center;">ℹ️ Este módulo utiliza automáticamente la Matriz, Stock y Artículos cargados en 'ARCHIVO INVENTARIO'.</div>`;"""
    
    content = target3_regex.sub(replacement3, content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    
    print(f"Updated {f}")
