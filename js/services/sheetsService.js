// MOCK DE DATOS PARA SIMULAR GOOGLE SHEETS
const mockDatabase = {
  bodega: [
    { id: '1', item: 'Cajas de Cartón A4', qty: 500, status: 'Disponible' },
    { id: '2', item: 'Cinta Adhesiva', qty: 20, status: 'Bajo Stock' },
    { id: '3', item: 'Pallets Madera', qty: 50, status: 'Disponible' }
  ],
  transporte: [
    { id: 'TR-1', driver: 'Juan Pérez', vehicle: 'Camión QW-123', status: 'En Ruta' },
    { id: 'TR-2', driver: 'María Gómez', vehicle: 'Furgón YZ-890', status: 'Mantenimiento' }
  ],
  proveedores: [
    { id: 'P-1', name: 'Empaques Globales', category: 'Insumos', rating: '5/5' },
    { id: 'P-2', name: 'Rutas Seguras SA', category: 'Logística Externa', rating: '4/5' }
  ]
};

export const fetchSheetData = async (sheetName) => {
  // Simulamos llamada a la API de Google Sheets
  await new Promise(resolve => setTimeout(resolve, 600));
  
  if (mockDatabase[sheetName]) {
    return { success: true, data: mockDatabase[sheetName] };
  }
  return { success: false, message: 'Hoja no encontrada' };
};
