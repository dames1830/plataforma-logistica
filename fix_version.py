import os

files = ['js/views/dashboard_v24.js', 'js/views/dashboard_v6.js', 'js/views/login.js', 'js/app.js']

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Simple replace for version
    content = content.replace('v26.5.457', 'v26.5.458')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    
    print(f"Updated version in {f}")
