# -*- coding: utf-8 -*-
"""Las seis programaciones de recepcion, leidas a mano de las imagenes del correo.

Cada una se comprueba contra sus propios totales ANTES de publicarse: el UND de
cada cita tiene que ser la suma de sus cantidades por orden, y la suma de los UND
tiene que dar el TOTAL del cuadro. Lo que no cuadre, se dice.
"""
import io, json


def c(tipo, hora, prov, oc, cant=None, und=None, nota=''):
    return {'tabla': 0, 'tipo': tipo, 'hora': hora, 'proveedor': prov, 'oc': oc,
            'ocPegada': oc.replace('-', ''), 'cantidad': cant, 'und': und,
            'nota': nota, 'dudoso': False}


D = {}

D['2026-09-03'] = (4722, [
    c('CALZADO', '08:20 AM', 'ADIDAS', '2026-10341', 845, 4286),
    c('CALZADO', '08:20 AM', 'ADIDAS', '2026-09563', 87),
    c('CALZADO', '08:20 AM', 'ADIDAS', '2026-09801', 84),
    c('CALZADO', '08:20 AM', 'ADIDAS', '2026-10333', 3270),
    c('CALZADO', '10:40 AM', 'TEXTIL GROUP C&B SAC', '2026-09501', 126, 406),
    c('CALZADO', '10:40 AM', 'TEXTIL GROUP C&B SAC', '2026-09872', 280),
    c('CALZADO', '11:20 AM', 'HUAMANI', '2026-05036', 298, 436),
    c('CALZADO', '11:20 AM', 'HUAMANI', '2026-09659', 138),
    c('ETIQUETAS', '02:00 PM', 'SKECHERS', '2026-10666', None, None,
      '88724 SKECHERS 2026-10666 Etiquetas 1008'),
    c('ETIQUETAS', '02:30 PM', 'D BRIGITTE SAC', '2026-10208', None, None,
      'D BRIGITTE SAC 2026-10208 / 2026-10205 / 2026-10213 / 2026-10210 - Etiqueta / Codigo de barras'),
])

D['2026-09-04'] = (4011, [
    c('CALZADO', '08:20 AM', 'D FASTER', '2026-09057', 134, 2799),
    c('CALZADO', '08:20 AM', 'D FASTER', '2026-08705', 205),
    c('CALZADO', '08:20 AM', 'D FASTER', '2026-09054', 560),
    c('CALZADO', '08:20 AM', 'D FASTER', '2026-08605', 1138),
    c('CALZADO', '08:20 AM', 'D FASTER', '2026-09773', 762),
    c('CALZADO', '10:30 AM', 'INDUSTRIAS WINDSOR', '2026-10570', None, 840),
    c('CALZADO', '11:30 AM', 'CALZADO PASITOS', '2026-09535', None, 372),
    c('CAJAS', '02:00 PM', 'TRUPAL', '', None, None, '89422 CAJA BTS 22'),
    c('ETIQUETAS', '03:00 PM', 'INDUSTRIA PROCESADORA DEL PLASTICO', '2026-10443'),
    c('MATERIALES', '08:30 AM', 'BANEIRO CALZADOS SAC', '', None, None,
      'M000683 M000684 M000685 M000686 M000687'),
])

D['2026-09-07'] = (0, [
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-09368', 1052, 6545),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08394', 759),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08392', 928),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08733', 118),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08610', 878),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-09325', 549),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08397', 663),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-08611', 322),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-05050', 25),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-05037', 34),
    c('CALZADO', '08:20 AM', 'ORCEM', '2026-09368', 1217),
    c('RECOJO DE ACCESORIOS', '10:00 AM', 'AMPHORA', '', None, None, 'RA01338'),
    c('CINTA BATA', '11:30 AM', 'BOSST PACKING SAC', '2026-10765', None, None,
      '2026-10765 BOSST PACKING SAC 998 und - 28 CAJAS'),
    c('ETIQUETAS', '02:00 PM', 'PUMA', '2026-10839', None, None,
      '2026-10839 Bata Retail FTW 3732'),
    c('ETIQUETAS', '03:00 PM', 'INDUSTRIA PROCESADORA DEL PLASTICO', '2026-10443'),
])

D['2026-09-08'] = (0, [
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-10528', 72, 2712),
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-10527', 54),
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-10526', 48),
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-09562', 828),
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-10334', 702),
    c('CALZADO', '08:20 AM', 'SKECHERS', '2026-10666', 1008),
    c('CALZADO', '10:00 AM', 'ALEXIA', '2026-04907', 2, 2996),
    c('CALZADO', '10:00 AM', 'ALEXIA', '2026-05108', 10),
    c('CALZADO', '10:00 AM', 'ALEXIA', '2026-08708', 2984),
    c('BOLSAS', '11:30 AM', 'PACIFIC PACKING', '', None, None,
      'BOLSA DE PAPEL FSC BUBBLEGUMMERS 3 PERU 36x15x48 - BOLSA DE PAPEL FSC WEINBRENNER 2 PERU 36x15x48 (x2)'),
    c('MATERIALES', '08:30 AM', 'D BRIGITTE', '', None, None,
      'M000700 M000701 M000702 M000703'),
    c('MATERIALES', '09:00 AM', 'CHAVARRI', '', None, None,
      'M000694 M000695 M000696 M000697 M000698 M000699'),
    c('MATERIALES', '09:30 AM', 'CLIFOR', '', None, None, 'M000691 M000692 M000693'),
])

D['2026-09-09'] = (1240, [
    c('CALZADO', '08:20 AM', 'AKARU', '2026-08389', 656, 1240),
    c('CALZADO', '08:20 AM', 'AKARU', '2026-08591', 438),
    c('CALZADO', '08:20 AM', 'AKARU', '2026-09553', 142),
    c('CALZADO', '08:20 AM', 'AKARU', '2026-09473', 4),
    c('ETIQUETAS', '01:00 PM', 'PUMA', '2026-09583', None, None,
      '2026-09583 889-6543 24 / 2026-09577 589-6543 24 / 2026-10935 589-9511 240 / 2026-10935 589-6541 324'),
    c('ETIQUETAS', '02:00 PM', 'CHAVARRI', '2026-10100', None, None,
      '2026-10100 6180 CODIGO DE BARRAS 35-39 / 2026-10101 10665 CODIGO DE BARRAS 34-39 / 2026-10268 3765 CODIGO DE BARRAS 30-37 / 2026-10271 8650 CODIGO DE BARRAS 30-37 / 2026-10272 12080 CODIGO DE BARRA 30-37'),
    c('ETIQUETAS', '02:30 PM', 'SKECHERS', '2026-10902', None, None,
      '88724 SKECHERS 2026-10902 Etiquetas 54 / 2026-10934 1116 / 2026-10933 2142 / 2026-10932 1098'),
    c('ETIQUETAS', '03:00 PM', 'CLIFOR', '2026-10319', None, None,
      '2026-10319 / 2026-10250 / 2026-10251 / 2026-10250 - detallado por correo'),
    c('ETIQUETAS', '03:30 PM', 'TEXTILES ARVAL', '2600-05870', None, None,
      '2600-05870 BATA BTW 480'),
    c('MATERIALES', '08:30 AM', 'D FASTER', '', None, None,
      'M000704 M000705 M000706 M000707 M000708'),
    c('MATERIALES', '09:00 AM', 'ALEXIA', '', None, None, 'M000710 M000711 M000712'),
])

D['2026-09-11'] = (7616, [
    c('CALZADO', '08:20 AM', 'ADIDAS', '2026-10341', None, 4721),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-09368', 191, 2895),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-08394', 103),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-08392', 689),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-05037', 119),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-08610', 635),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-09325', 138),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-08397', 95),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-08611', 107),
    c('CALZADO', '10:40 AM', 'ORCEM', '2026-09368', 818),
    c('ETIQUETAS', '02:00 PM', 'D BRIGITTE', '2026-10208', None, None,
      '81002 D BRIGITTE SAC - 2026-10208 / 2026-10205 / 2026-10213 / 2026-10210'),
    c('CAJAS', '02:30 PM', 'PAPELERA DEL SUR', '', None, None,
      'CAJA M1 525x330x275 (700CK) CANT 850 / CAJA M1.1 425x330x275 CANT 1560 / CAJA M2.1 435x350x300 CANT 2300 / CAJA M3 585x380x320 CANT 3400 / CAJA M3.1 470x380x320 CANT 2650 / CAJA M6 710x380x320 CANT 1900'),
    c('MATERIALES', '08:30 AM', 'ALEXIA', '', None, None, 'M000710 M000711 M000712'),
])


def comprobar(total_tabla, citas):
    """Las dos cuentas que hace Daniel con la calculadora, al reves."""
    calz = [x for x in citas if 'CALZ' in x['tipo']]
    problemas = []
    grupo = None
    for x in calz + [None]:
        if x is None or x['und'] is not None:
            if grupo is not None and suma and grupo != suma:
                problemas.append('%s: sus ordenes suman %d y su UND dice %d' % (prov, suma, grupo))
            if x is None:
                break
            grupo, suma, prov = x['und'], x['cantidad'] or 0, x['proveedor']
        else:
            suma += x['cantidad'] or 0
    und = sum(x['und'] or 0 for x in calz)
    if total_tabla and und != total_tabla:
        problemas.append('el TOTAL del correo dice %d y las citas suman %d' % (total_tabla, und))
    return und, sum(x['cantidad'] or 0 for x in calz), problemas


salida = {}
print('%-12s %9s %9s %14s  %s' % ('DIA', 'SUMA UND', 'SUMA O/C', 'TOTAL CUADRO', 'COMPROBACION'))
for fecha in sorted(D):
    total_tabla, citas = D[fecha]
    und, por_oc, problemas = comprobar(total_tabla, citas)
    print('%-12s %9d %9d %14s  %s'
          % (fecha, und, por_oc, total_tabla or '(el correo: 0)',
             'CUADRA' if not problemas else ' | '.join(problemas)))
    salida[fecha] = {'citas': citas, 'totalProgramado': und,
                     'totalDeLaTabla': total_tabla or None,
                     'cuadra': not problemas, 'problemas': problemas}

io.open('citas_corregidas.json', 'w', encoding='utf-8').write(json.dumps(salida, ensure_ascii=False))
print()
print('generado citas_corregidas.json con %d dias' % len(salida))
