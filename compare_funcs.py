import sys
import re

# Read both files
with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash_lines = f.readlines()
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    pub_lines = f.readlines()

def extract_function(lines, start_line_1indexed, func_name):
    """Extract function from lines, returns (start_0idx, end_0idx, content)"""
    start = start_line_1indexed - 1
    brace_count = 0
    end = start
    for i in range(start, len(lines)):
        brace_count += lines[i].count('{') - lines[i].count('}')
        if i > start and brace_count <= 0:
            end = i
            break
    return start, end, ''.join(lines[start:end+1])

# Check if function bodies are identical
_, _, dash_hourly = extract_function(dash_lines, 15785, 'renderHourlyProductionReport')
_, _, pub_hourly = extract_function(pub_lines, 804, 'renderHourlyProductionReport')

# Normalize whitespace for comparison
def normalize(s):
    return re.sub(r'\s+', ' ', s).strip()

print('renderHourlyProductionReport identical:', normalize(dash_hourly) == normalize(pub_hourly))

# Find renderWeeklyStorageReport
dash_weekly_start = None
pub_weekly_start = None
for i, line in enumerate(dash_lines):
    if 'const renderWeeklyStorageReport' in line:
        dash_weekly_start = i + 1
        break
for i, line in enumerate(pub_lines):
    if 'const renderWeeklyStorageReport' in line:
        pub_weekly_start = i + 1
        break

print(f'renderWeeklyStorageReport: dash line {dash_weekly_start}, pub line {pub_weekly_start}')

if dash_weekly_start and pub_weekly_start:
    _, _, dash_weekly = extract_function(dash_lines, dash_weekly_start, 'renderWeeklyStorageReport')
    _, _, pub_weekly = extract_function(pub_lines, pub_weekly_start, 'renderWeeklyStorageReport')
    print('renderWeeklyStorageReport identical:', normalize(dash_weekly) == normalize(pub_weekly))
    print(f'dash size: {len(dash_weekly)} chars, pub size: {len(pub_weekly)} chars')

# Find renderWeeklyDailyChartSection
dash_chart_start = None
pub_chart_start = None
for i, line in enumerate(dash_lines):
    if 'const renderWeeklyDailyChartSection' in line:
        dash_chart_start = i + 1
        break
for i, line in enumerate(pub_lines):
    if 'const renderWeeklyDailyChartSection' in line:
        pub_chart_start = i + 1
        break

print(f'renderWeeklyDailyChartSection: dash line {dash_chart_start}, pub line {pub_chart_start}')
if dash_chart_start and pub_chart_start:
    _, _, dash_chart = extract_function(dash_lines, dash_chart_start, 'renderWeeklyDailyChartSection')
    _, _, pub_chart = extract_function(pub_lines, pub_chart_start, 'renderWeeklyDailyChartSection')
    print('renderWeeklyDailyChartSection identical:', normalize(dash_chart) == normalize(pub_chart))
    print(f'dash size: {len(dash_chart)} chars, pub size: {len(pub_chart)} chars')
