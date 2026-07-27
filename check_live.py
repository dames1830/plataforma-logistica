import urllib.request
import re

req = urllib.request.Request(
    'https://deam1830.com',
    headers={
        'User-Agent': 'Mozilla/5.0',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
    }
)
response = urllib.request.urlopen(req)
html = response.read().decode('utf-8')

versions = set(re.findall(r'v26\.5\.\d+', html))
print('Versiones en el servidor LIVE:', versions)

scripts = re.findall(r'src="[^"]*\.js[^"]*"', html)
print('Scripts cargados:')
for s in scripts:
    print(' ', s)
