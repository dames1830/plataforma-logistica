import sys
import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    text = f.read()

def extract(name):
    start = text.find('const ' + name + ' = (tasksList) => {')
    if start == -1: return ''
    count = 0
    in_str = False
    str_char = ''
    end = -1
    for i in range(start, len(text)):
        c = text[i]
        if not in_str:
            if c in ['\'', '\"', '`']:
                in_str = True
                str_char = c
            elif c == '{': count += 1
            elif c == '}': 
                count -= 1
                if count == 0:
                    end = i + 1
                    break
        else:
            if c == str_char and text[i-1] != '\\':
                in_str = False
    return text[start:end]

with open('almacenaje_funcs.js', 'w', encoding='utf-8') as f:
    f.write(extract('renderWorkerPerformanceReport') + '\n\n')
    f.write(extract('renderHourlyProductionReport') + '\n\n')
    f.write(extract('renderWeeklyStorageReport') + '\n\n')
    f.write(extract('renderWeeklyDailyChartSection') + '\n\n')
