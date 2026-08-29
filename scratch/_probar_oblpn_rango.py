# -*- coding: utf-8 -*-
"""Corre run() del OBLPN con todo simulado, para ver que baja dia por dia y que un dia
   caido no arrastra a los demas."""
import sys, types, datetime, os
sys.path.insert(0, 'robot')
salida = []

class WMS:
    log = None; WMS_USER = 'x'; WMS_PASSWORD = 'y'
    captura = staticmethod(lambda *a: None)
    _base_onedrive = staticmethod(lambda: 'C:/tmp')
    @staticmethod
    def con_reintentos(nom, fn, page):
        if '26-08' in nom:                      # este falla a proposito
            raise RuntimeError('se cayo Oracle')
        return fn()

sys.modules['wms_automation_final'] = WMS
sys.modules['bloqueo_wms'] = types.SimpleNamespace(
    esperar_turno=lambda log, **k: True, tomar=lambda q: None, soltar=lambda: None)

class Nav:
    def new_context(self): return self
    def new_page(self):
        return types.SimpleNamespace(
            goto=lambda u: None, wait_for_selector=lambda *a, **k: None, fill=lambda *a: None,
            locator=lambda s: types.SimpleNamespace(first=types.SimpleNamespace(click=lambda: None)))
    def close(self): pass

class PW:
    chromium = types.SimpleNamespace(launch=lambda **k: Nav())
    def __enter__(self): return self
    def __exit__(self, *a): pass

sys.modules['playwright'] = types.ModuleType('playwright')
sys.modules['playwright.sync_api'] = types.SimpleNamespace(sync_playwright=lambda: PW())
os.makedirs('C:/tmp/OBLPN Embalaje', exist_ok=True)

import oblpn_embalaje as ob
ob.descargar_oblpn = lambda page, destino, dia, **k: (
    salida.append(('baja', os.path.basename(destino))) or True)

class F:
    log = staticmethod(lambda m, n='INFO':
        salida.append(('log', m.strip()[:56])) if ('bajado' in m or 'LISTO' in m or 'NO se' in m) else None)
    abrir_log = staticmethod(lambda: None)
    dia_pedido = staticmethod(lambda: datetime.date(2026, 8, 28))

ob.po = F
import time as _t
_t.sleep = lambda s: None
sys.argv = ['x', '--desde', '25-08-2026', '--hasta', '27-08-2026']
r = ob.run()
print('devolvio:', r, ' (0 = todos bien, 1 = alguno fallo)')
for k, v in salida:
    print('   %-6s %s' % (k, v))
