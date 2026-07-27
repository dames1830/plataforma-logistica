import urllib.request
import re

# Fetch with cache-busting
for url in [
    'https://deam1830.com/index.html?nocache=1',
    'https://deam1830.com',
    'https://raw.githubusercontent.com/dames1830/plataforma-logistica/main/index.html'
]:
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
        })
        response = urllib.request.urlopen(req, timeout=10)
        html = response.read().decode('utf-8')
        versions = set(re.findall(r'v26\.5\.\d+', html))
        script_srcs = re.findall(r'src="[^"]*app\.js[^"]*"', html)
        print(f'\n=== {url} ===')
        print(f'Versiones: {versions}')
        print(f'Scripts: {script_srcs}')
        print(f'Server header: {response.headers.get("Server", "?")}')
        print(f'X-Cache: {response.headers.get("X-Cache", "?")}')
        print(f'Age: {response.headers.get("Age", "?")}s')
    except Exception as e:
        print(f'\n=== {url} ===')
        print(f'ERROR: {e}')
