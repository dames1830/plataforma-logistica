import os

files = ['index.html', 'js/views/dashboard_v24.js', 'js/views/dashboard_v6.js', 'js/views/login.js', 'js/app.js']

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace('26.5.457', '26.5.459')
    content = content.replace('26.5.458', '26.5.459')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    
    print(f"Updated version in {f}")
