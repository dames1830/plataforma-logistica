with open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
'''        const getColSafe = (row, possibleNames) => {
            if (!row) return '';
            for (const key of Object.keys(row)) {
                const upperKey = key.toUpperCase().trim();
                if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
            }
        };''',
'''        const getColSafe = (row, possibleNames) => {
            if (!row) return '';
            for (const key of Object.keys(row)) {
                const upperKey = key.toUpperCase().trim();
                if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
            }
            return '';
        };'''
)

with open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(text)

