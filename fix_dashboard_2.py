import sys
import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    ("workerRanking[0]?.avg", "(workerRanking[0] ? workerRanking[0].avg : undefined)"),
    ("document.getElementById('chartEvolution')?.getContext('2d')", "(document.getElementById('chartEvolution') ? document.getElementById('chartEvolution').getContext('2d') : null)"),
    ("document.getElementById('chartRanking')?.getContext('2d')", "(document.getElementById('chartRanking') ? document.getElementById('chartRanking').getContext('2d') : null)"),
    ("allowedSubSubs[0]?.id", "(allowedSubSubs[0] ? allowedSubSubs[0].id : undefined)"),
    ("row.querySelector(`[id^=\"rend-\"]`)?.textContent", "(row.querySelector(`[id^=\"rend-\"]`) ? row.querySelector(`[id^=\"rend-\"]`).textContent : undefined)"),
    ("kpiHistory[idx]?.id", "(kpiHistory[idx] ? kpiHistory[idx].id : undefined)"),
    ("document.getElementById('btnExportUCA')?.addEventListener", "if (document.getElementById('btnExportUCA')) document.getElementById('btnExportUCA').addEventListener"),
    ("routes[0]?.id", "(routes[0] ? routes[0].id : undefined)"),
    ("document.getElementById('btn_back_to_office')?.addEventListener", "if (document.getElementById('btn_back_to_office')) document.getElementById('btn_back_to_office').addEventListener"),
    ("document.getElementById('driver_selector')?.addEventListener", "if (document.getElementById('driver_selector')) document.getElementById('driver_selector').addEventListener"),
    ("document.getElementById('btn_driver_start')?.addEventListener", "if (document.getElementById('btn_driver_start')) document.getElementById('btn_driver_start').addEventListener"),
    ("document.getElementById('btn_upload_descarga')?.addEventListener", "if (document.getElementById('btn_upload_descarga')) document.getElementById('btn_upload_descarga').addEventListener"),
    ("document.getElementById('btn_upload_cargo')?.addEventListener", "if (document.getElementById('btn_upload_cargo')) document.getElementById('btn_upload_cargo').addEventListener"),
    ("document.getElementById('btn_deliver_stop')?.addEventListener", "if (document.getElementById('btn_deliver_stop')) document.getElementById('btn_deliver_stop').addEventListener"),
    ("cachedStatuses[id]?.status", "(cachedStatuses[id] ? cachedStatuses[id].status : undefined)"),
    ("cachedStatuses[id]?.date", "(cachedStatuses[id] ? cachedStatuses[id].date : undefined)"),
    ("cachedStatuses[id]?.liquidated", "(cachedStatuses[id] ? cachedStatuses[id].liquidated : undefined)"),
    ("cachedStatuses[id]?.cobroFlete", "(cachedStatuses[id] ? cachedStatuses[id].cobroFlete : undefined)"),
    ("cachedStatuses[id]?.fotoCargo", "(cachedStatuses[id] ? cachedStatuses[id].fotoCargo : undefined)"),
    ("cachedStatuses[id]?.fotoLocal", "(cachedStatuses[id] ? cachedStatuses[id].fotoLocal : undefined)"),
    ("document.getElementById('kpi_nr_desde')?.addEventListener", "if (document.getElementById('kpi_nr_desde')) document.getElementById('kpi_nr_desde').addEventListener"),
    ("document.getElementById('kpi_nr_hasta')?.addEventListener", "if (document.getElementById('kpi_nr_hasta')) document.getElementById('kpi_nr_hasta').addEventListener"),
    ("document.getElementById('tracking_search')?.addEventListener", "if (document.getElementById('tracking_search')) document.getElementById('tracking_search').addEventListener"),
    ("document.getElementById('tracking_desde')?.addEventListener", "if (document.getElementById('tracking_desde')) document.getElementById('tracking_desde').addEventListener"),
    ("document.getElementById('tracking_hasta')?.addEventListener", "if (document.getElementById('tracking_hasta')) document.getElementById('tracking_hasta').addEventListener"),
    ("document.getElementById('btn_sync_tracking')?.addEventListener", "if (document.getElementById('btn_sync_tracking')) document.getElementById('btn_sync_tracking').addEventListener"),
    ("document.getElementById('btn_track_prev')?.addEventListener", "if (document.getElementById('btn_track_prev')) document.getElementById('btn_track_prev').addEventListener"),
    ("document.getElementById('btn_track_next')?.addEventListener", "if (document.getElementById('btn_track_next')) document.getElementById('btn_track_next').addEventListener"),
    ("document.getElementById('btn_nr_logout')?.addEventListener", "if (document.getElementById('btn_nr_logout')) document.getElementById('btn_nr_logout').addEventListener")
]

for old, new in replacements:
    text = text.replace(old, new)

with open('js/views/dashboard_v28.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Replaced safely.")
