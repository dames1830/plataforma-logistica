import re

with open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. isMzn01 -> add isMzn02
text = text.replace(
    "const isMzn01 = currentLayoutZona === 'MZN01' && (ubi.startsWith('MZN01') || ubi.startsWith('MZ01'));",
    "const isMzn01 = currentLayoutZona === 'MZN01' && (ubi.startsWith('MZN01') || ubi.startsWith('MZ01'));\n                const isMzn02 = currentLayoutZona === 'MZN02' && (ubi.startsWith('MZN02') || ubi.startsWith('MZ02'));"
)
text = text.replace(
    "if (currentLayoutZona === 'MZN01' && !isMzn01) return;",
    "if (currentLayoutZona === 'MZN01' && !isMzn01) return;\n                if (currentLayoutZona === 'MZN02' && !isMzn02) return;"
)

# 2. isSaldo
text = text.replace(
    "const isSaldo = currentLayoutZona === 'MZN01' ? totalStockForPadre < 80 : totalStockForPadre < 20;",
    "const isSaldo = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? totalStockForPadre < 80 : totalStockForPadre < 20;"
)

# 3. ubiClean logic
text = text.replace(
    "if (currentLayoutZona === 'SEL' || currentLayoutZona === 'MZN01') {",
    "if (currentLayoutZona === 'SEL' || currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') {"
)
text = text.replace(
    "if (currentLayoutZona === 'MZN01') ubiClean = ubiClean.replace(/MZN01|MZ01/g, '');\n                    else if (currentLayoutZona === 'SEL') ubiClean = ubiClean.replace(/SEL/g, '');",
    "if (currentLayoutZona === 'MZN01') ubiClean = ubiClean.replace(/MZN01|MZ01/g, '');\n                    else if (currentLayoutZona === 'MZN02') ubiClean = ubiClean.replace(/MZN02|MZ02/g, '');\n                    else if (currentLayoutZona === 'SEL') ubiClean = ubiClean.replace(/SEL/g, '');"
)

# 4. maxCols
text = text.replace(
    "let maxCols = currentLayoutZona === 'MZN01' ? 24 : 14;",
    "let maxCols = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? 24 : 14;"
)
text = text.replace(
    "let maxColsRes = currentLayoutZona === 'MZN01' ? 24 : 14;",
    "let maxColsRes = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? 24 : 14;"
)

# 5. isValid logic for MZN01 and MZN02
orig_valid = '''                      } else if (currentLayoutZona === 'MZN01') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 4 && col <= 11) isValid = true;
                                else if (col >= 12 && col <= 21) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col === 22 || col === 23) isValid = true;
                            } else if (isSaldo) {
                                if (col === 2 || col === 3 || col === 24) isValid = true;
                            }
                        }'''

repl_valid = '''                      } else if (currentLayoutZona === 'MZN01') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 4 && col <= 11) isValid = true;
                                else if (col >= 12 && col <= 21) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col === 22 || col === 23) isValid = true;
                            } else if (isSaldo) {
                                if (col === 2 || col === 3 || col === 24) isValid = true;
                            }
                        } else if (currentLayoutZona === 'MZN02') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 8 && col <= 24) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col >= 4 && col <= 7) isValid = true;
                            } else if (isSaldo) {
                                if (col >= 1 && col <= 3) isValid = true;
                            }
                        }'''

text = text.replace(orig_valid, repl_valid)

# 6. grid array definitions
text = text.replace(
    "const totalCols = currentLayoutZona === 'MZN01' ? 24 : 14;",
    "const totalCols = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? 24 : 14;"
)
text = text.replace(
    "const maxRows = currentLayoutZona === 'MZN01' ? 20 : 22;",
    "const maxRows = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? 20 : 22;"
)
text = text.replace(
    "if (currentLayoutZona === 'MZN01') {",
    "if (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') {"
)

# Wait, there are multiple "if (currentLayoutZona === 'MZN01') {"
# Let's be precise.
# We have:
# if (currentLayoutZona === 'MZN01') {
#    for (let i = 24; i >= 1; i--) colsArray.push(i);
# } else {
orig_cols_array = '''            if (currentLayoutZona === 'MZN01') {
                for (let i = 24; i >= 1; i--) colsArray.push(i);
            } else {'''
repl_cols_array = '''            if (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') {
                for (let i = 24; i >= 1; i--) colsArray.push(i);
            } else {'''
text = text.replace(orig_cols_array, repl_cols_array)

# 7. cellExists structure (holes in layout)
# MZN02 has the exact same structure as MZN01.
orig_cell1 = '''                    if (!isReserva && currentLayoutZona === 'MZN01') {
                        if ((c === 2 || c === 3) && r <= 3) cellExists = false;
                        if ((c === 22 || c === 23) && r <= 3) cellExists = false;
                    }'''
repl_cell1 = '''                    if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {
                        if ((c === 2 || c === 3) && r <= 3) cellExists = false;
                        if ((c === 22 || c === 23) && r <= 3) cellExists = false;
                    }'''
text = text.replace(orig_cell1, repl_cell1)

orig_cell2 = '''                    if (!isReserva && currentLayoutZona === 'MZN01') {
                        if (c === 2 || c === 3 || c === 22 || c === 23) {
                            logicalR = r - 3;
                        }'''
repl_cell2 = '''                    if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {
                        if (c === 2 || c === 3 || c === 22 || c === 23) {
                            logicalR = r - 3;
                        }'''
text = text.replace(orig_cell2, repl_cell2)

# 8. ACTUAL_TOTAL_CELLS
orig_cells_total = '''            } else if (!isReserva && currentLayoutZona === 'MZN01') {
                let count = 0;'''
repl_cells_total = '''            } else if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {
                let count = 0;'''
text = text.replace(orig_cells_total, repl_cells_total)

# 9. brandTitle
orig_brand = "const brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : 'BATA';"
repl_brand = "const brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : (currentLayoutZona === 'MZN02' ? 'NORTH STAR' : 'BATA');"
text = text.replace(orig_brand, repl_brand)

# 10. Filter blocker
orig_filter = "if (currentLayoutZona !== 'SEL' && currentLayoutZona !== 'MZN01') {"
repl_filter = "if (currentLayoutZona !== 'SEL' && currentLayoutZona !== 'MZN01' && currentLayoutZona !== 'MZN02') {"
text = text.replace(orig_filter, repl_filter)


with open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(text)

