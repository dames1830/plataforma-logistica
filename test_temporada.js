const skuTemporada = { '6646806': 'T. ACTUAL' };
let temporadaRaw = skuTemporada['6646806'] || 'DESCONOCIDA';
let temporadaClean = 'ANTERIOR'; 
const actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL'];
if (actuales.some(act => temporadaRaw.includes(act))) {
    temporadaClean = 'ACTUAL';
}
console.log(temporadaClean);
