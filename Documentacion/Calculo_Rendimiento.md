# Documentación: Cálculo Ponderado de Rendimiento

## Objetivo
Esta documentación explica la fórmula matemática y la lógica detrás del cálculo de **Rendimiento %** en el módulo de Asistencia e Historial del Sistema Logístico (implementado a partir de la versión v25.1.33).

## Distribución de Pesos y Puntuaciones
El sistema calcula el porcentaje final sobre un total de **100% (100 puntos)**. La evaluación se divide en 5 categorías con pesos específicos:

### 1. Asistencia (Peso Máximo: 30%)
Evalúa si el trabajador se presentó a laborar.
*   **Presente (`P`)**: Otorga **30 puntos** directos al cálculo.
*   **Falta (`F`)**: Otorga **0 puntos**.

### 2. Puntualidad (Peso Máximo: 10%)
Evalúa si el trabajador llegó a la hora establecida, independientemente de su asistencia.
*   **Puntual (`SÍ`)**: Otorga **10 puntos** directos al cálculo.
*   **Tardanza (`NO`)**: Otorga **0 puntos**.

### 3. Producción (Peso Máximo: 30%)
Métrica de productividad evaluada por el supervisor.
*   **Escala de Evaluación**: Del 1 al 10.
*   **Multiplicador Interno**: x 3.
*   *Ejemplo: Si el supervisor evalúa con un 5, el sistema calcula 5 x 3 = **15 puntos**.*
*   *Ejemplo: Si el supervisor evalúa con un 10, el sistema calcula 10 x 3 = **30 puntos**.*

### 4. BPA - Buenas Prácticas de Almacenamiento (Peso Máximo: 15%)
Métrica de calidad y orden evaluada por el supervisor.
*   **Escala de Evaluación**: Del 1 al 10.
*   **Multiplicador Interno**: x 1.5.
*   *Ejemplo: Si el supervisor evalúa con un 10, el sistema calcula 10 x 1.5 = **15 puntos**.*

### 5. Supervisor (Peso Máximo: 15%)
Evaluación general o apreciación del supervisor a cargo.
*   **Escala de Evaluación**: Del 1 al 10.
*   **Multiplicador Interno**: x 1.5.
*   *Ejemplo: Si el supervisor evalúa con un 10, el sistema calcula 10 x 1.5 = **15 puntos**.*

---

## Casos Prácticos y Comportamiento del Sistema

### Caso A: Empleado Perfecto
*   **Asistencia**: P (30 pts)
*   **Puntualidad**: SÍ (10 pts)
*   **Producción**: 10 (30 pts)
*   **BPA**: 10 (15 pts)
*   **Supervisor**: 10 (15 pts)
*   **Rendimiento Total**: 30 + 10 + 30 + 15 + 15 = **100%**

### Caso B: Empleado con Tardanza y Baja Producción
*   **Asistencia**: P (30 pts)
*   **Puntualidad**: NO (0 pts) -> Pierde 10 puntos automáticamente al cerrar asistencia.
*   **Producción**: 5 (15 pts)
*   **BPA**: 10 (15 pts)
*   **Supervisor**: 10 (15 pts)
*   **Rendimiento Total**: 30 + 0 + 15 + 15 + 15 = **75%**

## Notas Técnicas para el Módulo de Historial
*   **Cierre de Asistencia**: Al momento de tomar la asistencia y cerrarla, el sistema asumirá automáticamente las notas máximas de 10 en Producción, BPA y Supervisor. El cálculo se ajustará en tiempo real si el trabajador llegó tarde (arrancando en 90%).
*   **Edición Manual**: Cuando un supervisor ingresa a la pestaña "Historial" y modifica manualmente una nota de Producción, BPA o Supervisor (usando la escala de 1 a 10), el sistema recalculará instantáneamente el Rendimiento % aplicando los multiplicadores, manteniendo siempre los puntos fijos que el trabajador ganó o perdió en Asistencia y Puntualidad ese día.
