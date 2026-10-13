# Inventarios y valoración

Estado de verificación: ver [`README.md`](README.md). La mecánica de costos de este documento es aritmética
verificada por cálculo; las citas normativas son 🔶 hasta validación del contador.

## 1. Marco

| Norma | Aporta | Estado |
|---|---|---|
| NIIF para las Pymes, Sección 13 «Inventarios» | Medición al **menor** entre el costo y el precio de venta estimado menos los costos de terminación y venta; fórmulas de costo permitidas: **primeras en entrar, primeras en salir (PEPS)** o **promedio ponderado** (no se permite UEPS) | 🔶 |
| Estatuto Tributario, normas sobre costo fiscal de inventarios | El tratamiento fiscal puede diferir en detalle del contable | 🔶 — revisar con el contador |
| Decisión del proyecto | **Promedio ponderado móvil (perpetuo)**, un costo por ítem a nivel de empresa | S-03, R-INV-001 |

## 2. Conceptos

| Término | Definición en SIFCA |
|---|---|
| Movimiento | Entrada o salida de un ítem en una bodega y (opcional) lote, con fecha, cantidad, costo y documento origen. **Inmutable** |
| Kardex | Listado cronológico de movimientos de un ítem con saldo acumulado (cantidad, valor, promedio) |
| Saldo (`stock_balance`) | Existencia por ítem-bodega-lote (`on_hand`) y reservado |
| Costo (`item_cost`) | Cantidad total y **valor total** del ítem en la empresa; el promedio se **deriva** (`valor / cantidad`) |
| Disponible | `on_hand − reservado` |

## 3. Reglas

### R-INV-001 · Método de valoración
Promedio ponderado **móvil**: tras cada entrada se recalcula el promedio; las salidas se valoran al promedio
vigente. Un solo costo por ítem y empresa (no por bodega): los traslados no cambian el costo (R-INV-008).
- **Alternativa documentada:** costo por bodega, o PEPS, quedan como extensión futura detrás de la misma
  interfaz (`CostingStrategy`).

### R-INV-002 · Valor de una entrada
Costo de entrada = precio de compra − descuentos + costos de adquisición no recuperables (fletes, seguros,
aranceles) **+ IVA no descontable** (el IVA descontable no se capitaliza). Nuevo estado:

```text
cantidad' = cantidad + cantidad_entrada
valor'    = valor    + valor_entrada          (valor_entrada = Σ costos de la entrada, 2 decimales)
promedio' = valor' / cantidad'                (se muestra a 6 decimales; no se persiste)
```

### R-INV-003 · Costo de una salida y residuo cero
```text
costo_salida = redondear_2( valor × cantidad_salida / cantidad )       (half-up)
si cantidad_salida = cantidad  →  costo_salida = valor                 (la última salida vacía el valor)
valor'    = valor − costo_salida
cantidad' = cantidad − cantidad_salida
```
Se **persiste el valor total**, no el promedio: así el redondeo no acumula deriva y el saldo final es
exactamente 0.

**Ejemplo (kardex de referencia, fixture de pruebas):**

| # | Movimiento | Cantidad | Costo mov. | Saldo cant. | Saldo valor | Promedio derivado |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Compra 200 × 10.000 | +200 | 2000000,00 | 200 | 2000000,00 | 10000,000000 |
| 2 | Compra 100 × 11.000 | +100 | 1100000,00 | 300 | 3100000,00 | 10333,333333 |
| 3 | Venta | −120 | 1240000,00 | 180 | 1860000,00 | 10333,333333 |
| 4 | Venta | −70 | 723333,33 | 110 | 1136666,67 | 10333,333364 |
| 5 | Venta (vacía el saldo) | −110 | 1136666,67 | 0 | 0,00 | — |

Observe el movimiento 4: el promedio derivado (10.333,333364) difiere en el 8.º decimal del anterior por el
redondeo del valor a centavos. Es esperado; por eso el movimiento 5 toma el **valor remanente**
(1.136.666,67) y no `110 × 10.333,333333 = 1.136.666,66`.

### R-INV-004 · Movimientos inmutables
Un movimiento no se edita ni se borra. Una corrección es un **movimiento inverso** que referencia al original
(`reversal_of`). El kardex es solo de inserción; `running_quantity` y `running_value` se escriben en el mismo
momento del movimiento, con la fila de costo bloqueada.

### R-INV-005 · Devoluciones
- **Devolución en venta (nota crédito):** el inventario reingresa al **costo con el que salió** (guardado en
  `unit_cost_at_sale` de la línea), no al promedio del día. Ejemplo: devolución de 2 unidades vendidas a
  costo 60.000 ⇒ reingreso de $120.000 (P-02).
- **Devolución en compra:** sale al costo de la compra original; la diferencia contra el promedio actual
  queda en el promedio resultante.
- **Estado:** 🔶 — el tratamiento de la diferencia debe validarlo el contador.

### R-INV-006 · Movimientos con fecha anterior (retroactivos)
Un movimiento con fecha anterior al último movimiento del ítem cambia el costo de todas las salidas
posteriores. Política:
1. En **período cerrado**: prohibido (R-CON-004).
2. En **período abierto**: requiere el permiso `inventory.backdate`; se registra y un trabajo de
   **revaluación** recalcula los costos de salida posteriores y genera **un comprobante de ajuste** por la
   diferencia en costo de ventas e inventario. El recálculo es determinista e idempotente.
3. La revaluación corre bajo bloqueo del ítem; mientras tanto el ítem no admite nuevas salidas.

### R-INV-007 · Stock negativo
Por defecto **no** se permite vender más de lo que hay (la emisión de la factura falla con un error de
negocio). Una bodega puede permitirlo (`allows_negative_stock`); la salida se valora al último costo
conocido y, al reponer, el sistema reconoce la diferencia de costo (ajuste automático) 🔶. Se verifica con
una prueba de concurrencia (INV-08).

### R-INV-008 · Traslados entre bodegas
Dos movimientos (`TRANSFER_OUT` y `TRANSFER_IN`) con el mismo costo, creados en la misma transacción.
Variante en dos pasos: despacho (salida de la bodega origen a «en tránsito») y recepción. No tienen efecto
en resultados ni en el costo promedio de la empresa.

### R-INV-009 · Lotes y vencimientos
- Si el ítem `tracks_lots`: toda entrada exige lote (código, fecha de vencimiento opcional) y toda salida
  debe identificar de qué lote sale.
- Selección por defecto: **FEFO** (primero vence, primero sale); lotes vencidos no se venden.
- El **costo sigue siendo el promedio del ítem**, no el del lote; el lote aporta trazabilidad (útil en
  alimentos y productos con registro sanitario 🔶).
- Reporte de próximos a vencer.

### R-INV-010 · Deterioro (valor neto realizable)
Periódicamente se compara el costo con el precio de venta estimado menos costos de terminación y venta; si
es menor, se reconoce deterioro (gasto contra la cuenta de provisión de inventarios, grupo 14 🔶). **Fuera del
MVP**; el modelo no lo impide.

### R-INV-011 · Ajustes por toma física
Faltantes y sobrantes se ajustan al costo promedio, con comprobante propio, motivo obligatorio y permiso
(`inventory.adjust`). Contabilización: contra una cuenta de gasto (faltante) o ingreso (sobrante)
configurable por empresa (`posting_rule`).

### R-INV-012 · Tipos de ítem
| Tipo | Controla stock | Comportamiento |
|---|---|---|
| `SIMPLE` | Sí | Normal |
| `SERVICE` | No | Nunca genera movimientos |
| `KIT` | No (compuesto) | Al vender, descuenta el stock de sus componentes a su propio costo |
| `VARIANT_PARENT` | No | Agrupa variantes (talla, color…) |
| `VARIANT` | Sí | Se comporta como `SIMPLE` |

(Esta clasificación coincide con la de Alegra: `simple`, `kit`, `variantParent`, `variant`; ver
[`06-referencia-api-alegra.md`](06-referencia-api-alegra.md).)

### R-INV-013 · Reservas y disponibilidad
Un pedido web o de venta **reserva** stock con vencimiento (TTL configurable). La factura consume la reserva.
`disponible = on_hand − reservado`; la vitrina y las integraciones consultan el **disponible**, nunca
`on_hand`. Una reserva vencida se libera por un trabajo programado.

### R-INV-014 · Unidades de medida
Cantidades en la unidad base del ítem. Presentaciones alternativas (caja ×12) con factor de conversión
exacto (`numeric`); las cantidades se convierten a unidad base al registrar el movimiento.

### R-INV-015 · Conciliación inventario–contabilidad
Para cada cuenta de inventario del plan, la suma de `total_value` de los ítems asociados es igual al saldo
contable de la cuenta a la misma fecha. Un trabajo diario lo comprueba y alerta; es condición para el
cierre mensual (R-CON-011).

## 4. Reportes mínimos

| Reporte | Contenido |
|---|---|
| Kardex por ítem | Los campos del ejemplo de R-INV-003, con filtro por bodega, lote y rango de fechas |
| Existencias valoradas a una fecha | Cantidad, valor y costo promedio por ítem y bodega |
| Rotación y stock bajo mínimo | Basado en movimientos y mínimos por ítem |
| Próximos a vencer | Por lote (R-INV-009) |
| Conciliación con contabilidad | R-INV-015 |

## 5. Concurrencia (resumen)

Descontar stock bloquea, en orden determinista `(item_id, warehouse_id, lot_id)`, las filas de
`stock_balance` y la de `item_cost`; luego escribe el movimiento y actualiza los saldos en la misma
transacción que emite el documento. Detalle en `02-modelo-de-datos-preliminar.md` §4.
