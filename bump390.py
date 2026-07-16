import re
with open('js/app.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'APP_VERSION = ".*?"', 'APP_VERSION = "26.5.390"', c)
with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(c)
with open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'const DASH_VERSION = ".*?"', 'const DASH_VERSION = "26.5.390"', c)
with open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(c)
