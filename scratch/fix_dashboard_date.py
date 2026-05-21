import re

file_path = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                                    const displayDate = (() => {
                                        if (!row.fecha) return '---';
                                        const parts = row.fecha.split('-');
                                        if (parts.length !== 3) return row.fecha;
                                        return `${parts[2]}/${parts[1]}`;
                                    })();"""

# Let's write a flexible regex to match it regardless of exact spaces
pattern = r"const displayDate = \(\(\) => \{\s*if \(!row\.fecha\) return ['\"]---['\"];\s*const parts = row\.fecha\.split\(['\"].['\"]\);\s*if \(parts\.length !== 3\) return row\.fecha;\s*return `\$\{parts\[2\]\}/\$\{parts\[1\]\}`;\s*\}\)\(\);"

replacement = """const displayDate = (() => {
                                        if (!row.fecha) return '---';
                                        const parts = row.fecha.split('-');
                                        if (parts.length !== 3) return row.fecha;
                                        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                        const monthIdx = parseInt(parts[1], 10) - 1;
                                        if (monthIdx >= 0 && monthIdx < 12) {
                                            return `${parts[2]}-${months[monthIdx]}`;
                                        }
                                        return `${parts[2]}/${parts[1]}`;
                                    })();"""

new_content, count = re.subn(pattern, replacement, content)
print(f"Substituted: {count}")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)
