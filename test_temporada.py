temporadaRaw = "T. ACTUAL"
actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL']
temporadaClean = 'ANTERIOR'
for act in actuales:
    if act in temporadaRaw:
        temporadaClean = 'ACTUAL'
print(temporadaClean)
