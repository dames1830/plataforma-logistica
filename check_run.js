const fs = require("fs");
const code = fs.readFileSync("js/views/dashboard_v25.js", "utf8");

const ctx = {
    window: { DEBUG_SKU_GENDER: {}, globalLayoutData: {} },
    document: { 
        createElement: (tag) => ({ tag, style: {}, innerHTML: '', appendChild: () => {}, addEventListener: () => {} }),
        body: { insertAdjacentHTML: () => {} },
        addEventListener: () => {}
    },
    console: console,
    Math: Math,
    Date: Date,
    parseFloat: parseFloat,
    parseInt: parseInt,
    String: String,
    Array: Array,
    Set: Set,
    setTimeout: setTimeout,
    fetch: async () => ({ ok: false }),
    alert: () => {}
};
ctx.document.getElementById = () => ctx.document.createElement("div");

const vm = require("vm");
const script = new vm.Script(code.replace(/export const/g, "const"));
vm.createContext(ctx);
script.runInContext(ctx);

console.log("Parsed and loaded module functions");

// Now try to run renderLayoutActivo with mock data
const mockContainer = ctx.document.createElement("div");
ctx.dataStore = {
    buffer_activo: [
        ["FECHA", "ARTICULO", "DESCRIPCION", "CANTIDAD", "UBICACION", "ESTADO", "NIVEL"],
        ["2023-01-01", "12345678", "Desc", "10", "SEL 1 R 2", "OK", "ALTO"]
    ],
    analisis_sku_maestro: [
        ["ARTICULO", "TEMPORADA", "GENDER"],
        ["12345678", "ACTUAL", "MALE"]
    ],
    stockReserva: [
        ["FECHA", "ARTICULO", "DESCRIPCION", "CANTIDAD", "UBICACION", "ESTADO", "NIVEL"],
        ["2023-01-01", "12345678", "Desc", "10", "SEL 1 R 2", "OK", "ALTO"],
        ["2023-01-01", "12345678", "Desc", "10", "SEL 1 R 2", "OK", "ALTO"],
        ["2023-01-01", "12345678", "Desc", "10", "SEL 14 R 2", "OK", "ALTO"]
    ]
};

try {
    ctx.renderLayoutActivo(mockContainer);
    console.log("renderLayoutActivo ran synchronously without throwing");
} catch(e) {
    console.error("ERROR running renderLayoutActivo:", e);
}
