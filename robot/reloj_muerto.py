# -*- coding: utf-8 -*-
"""
EL RELOJ QUE MATA UNA CORRIDA COLGADA.

El 02-sep-2026 a las 02:00 el robot del stock entro al WMS, empezo a exportar el
Stock Reserva a las 02:15... y se le murio el navegador. El proceso quedo vivo
—38 minutos, 1 segundo de CPU, sin escribir una linea mas en el log— esperando
una descarga que no iba a llegar nunca, y CON EL CANDADO DEL WMS TOMADO. Los
demas robots se lo iban a encontrar ocupado hasta las 04:30.

Nadie aviso. Se encontro porque Daniel pidio revisar el servidor.

COMO FUNCIONA. Se arranca al principio de la corrida diciendo cuantos minutos
puede durar como mucho. Si al vencerse el plazo la corrida sigue viva, el reloj:

  1. lo deja escrito en el log, con el nombre del robot y cuanto aguanto
  2. suelta lo que haya que soltar -el candado del WMS- con `al_morir`
  3. mata el proceso

POR QUE `os._exit` Y NO UNA EXCEPCION. El proceso esta clavado dentro de codigo
nativo de Playwright esperando en el sistema operativo; una excepcion no llega
ahi y un `sys.exit` desde otro hilo tampoco. `os._exit` corta de raiz. Por eso
mismo NO se ejecutan los `finally`, y de ahi que `al_morir` sea obligatorio para
lo que haya que dejar limpio.

EL PLAZO SE MIDE CON HOLGURA, no al filo: se trata de cazar un colgado, no de
apurar una corrida lenta. Una corrida sana del stock son unos 9 minutos y el
propio WMS avisa que el reporte "puede tardar mas de 15"; el plazo va en 40.
"""
import os
import sys
import threading
from datetime import datetime

_puesto = None


def arrancar(minutos, log=None, al_morir=None, quien='la corrida'):
    """Pone el reloj. Devuelve la funcion para desactivarlo al terminar bien.

    `al_morir` se llama ANTES de matar y sus errores se tragan: si soltar el
    candado falla, igual hay que morir, que es lo importante.
    """
    global _puesto
    apuntar = log or (lambda t, n='INFO': print('[%s] %s' % (n, t)))

    def vencio():
        try:
            # %g y no %d: con un plazo de prueba de 0,1 el mensaje decia
            # "lleva 0 minutos", que se lee como un error del reloj.
            apuntar('EL RELOJ VENCIO: %s lleva %g minutos y no termino. Se corta.'
                    % (quien, minutos), 'ERROR')
            apuntar('Se corta a proposito: una corrida colgada deja el candado del '
                    'WMS tomado y bloquea a los demas robots.', 'ERROR')
        except Exception:
            pass
        if al_morir:
            try:
                al_morir()
            except Exception as e:
                try:
                    apuntar('Al limpiar antes de morir: %s' % e, 'AVISO')
                except Exception:
                    pass
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
        os._exit(2)

    _puesto = threading.Timer(minutos * 60.0, vencio)
    _puesto.daemon = True          # no impide que el proceso termine si va bien
    _puesto.start()

    def desactivar():
        try:
            if _puesto:
                _puesto.cancel()
        except Exception:
            pass

    return desactivar


def cancelar():
    """Por si al final es mas comodo llamarlo por su nombre que guardar la funcion."""
    try:
        if _puesto:
            _puesto.cancel()
    except Exception:
        pass
