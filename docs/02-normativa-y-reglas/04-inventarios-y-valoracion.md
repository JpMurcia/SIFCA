# Inventarios, kardex, valuación y logística

Estado de verificación: ver [`README.md`](README.md). La aritmética (costeo, ABC, punto de reorden) está
verificada por cálculo exacto; las citas normativas conservan su marca ✅ / ⚠️ / 🔶. Los umbrales de negocio
(80/95 % del ABC, niveles de servicio, ventanas de demanda) son **parámetros configurables**, no normativa.

## 1. Marco

| Norma o criterio | Aporta | Estado |
|---|---|---|
| NIIF para las Pymes, Sección 13 «Inventarios» (Grupo 2) y NIC 2 (Grupo 1) | Medición al **menor** entre el costo y el valor neto realizable; fórmulas de costo admitidas: **PEPS (FIFO)** y **promedio ponderado**; identificación específica para ítems no intercambiables. **UEPS (LIFO) no se admite como fórmula de costo** | ⚠️ (fuentes secundarias coinciden; no se leyó el texto oficial) |
| Estatuto Tributario art. 65 (modificado por el art. 44 de la Ley 1819 de 2016) | Para obligados a llevar contabilidad, las fórmulas de costo y técnicas de medición **son las de la técnica contable** o las que determine el Gobierno; ya no se exige autorización para cambiar el método | ⚠️ ([resumen de fuentes secundarias](https://estatuto.co/65)) |
| Estatuto Tributario art. 62 (modificado por la Ley 1819 de 2016) | El costo de los inventarios enajenados se establece con el sistema de inventarios **permanentes** o periódicos | ⚠️ |
| Decreto 2706 de 2012 (microempresas, Grupo 3), capítulo de inventarios | Reglas simplificadas para Grupo 3 | 🔶 (Q-05) |
| Política del proyecto (no es norma) | Costeo por ítem; **FIFO obligatorio para ítems perecederos** (con fecha de vencimiento); promedio ponderado por defecto; UEPS solo como política de despacho físico | Decisión de producto |

> **Conclusión de diseño.** El costeo **financiero oficial** (el que alimenta el costo de ventas y el
> inventario del balance) se registra **solo** en **PEPS** o **Promedio ponderado**. UEPS/LIFO se habilita
> únicamente como *política de despacho físico* (qué unidad se saca de la bodega), nunca como método de
> costeo (R-INV-001, R-INV-017). Si el negocio saca físicamente de forma UEPS, el costo registrado sigue
> siendo PEPS o promedio.

## 2. Conceptos

| Término | Definición en SIFCA |
|---|---|
| Movimiento | Entrada o salida de un ítem en una bodega y (opcional) lote, con fecha, cantidad, costo y documento origen. **Inmutable** |
| Kardex | Listado cronológico de movimientos de un ítem con saldo acumulado (cantidad, valor, costo) |
| Saldo (`stock_balance`) | Existencia por ítem-bodega-lote (`on_hand`) y reservado |
| Costo del ítem | Depende del método: promedio → `item_cost` (cantidad y **valor** totales); PEPS → **capas** (`cost_layer`) |
| Capa PEPS | Entrada con su costo unitario y su cantidad **restante** |
| Disponible | `on_hand − reservado`, solo en bodegas «vendibles» |
| Posición de inventario | `disponible + cantidades en órdenes de compra abiertas` (R-INV-033) |
| Flujo de costo vs. flujo físico | El **costo** se asigna por el método elegido (PEPS/promedio); la **unidad física** que sale la decide la política de despacho (R-INV-017). Son independientes |

## 3. Métodos de valuación y costeo

### R-INV-001 · Métodos de costeo permitidos y selección por ítem
Cada ítem que controla inventario tiene un `costing_method` ∈ {`WEIGHTED_AVERAGE`, `FIFO`}.

| Situación | Método |
|---|---|
| Mercancía general | `WEIGHTED_AVERAGE` (**por defecto**, configurable por tenant y por categoría) |
| Ítem **perecedero** (`tracks_expiry = true`: lotes con fecha de vencimiento) | `FIFO` **obligatorio**; el sistema rechaza `WEIGHTED_AVERAGE` con `COSTING_METHOD_NOT_ALLOWED` |
| Cualquiera | `LIFO` **no es un valor válido** de `costing_method` |

- **Fuente:** ver §1. El requisito de PEPS para perecederos es política del proyecto.
- **Estado:** ⚠️ (fórmulas admitidas) · decisión de producto (perecederos).
- **Prueba:** crear un ítem con `tracks_expiry = true` y `WEIGHTED_AVERAGE` ⇒ error; `costing_method = LIFO` ⇒ error de esquema (Zod).

### R-INV-002 · Valor de una entrada
Costo de entrada = precio de compra − descuentos + costos de adquisición no recuperables (fletes, seguros,
aranceles) **+ IVA no descontable** (el IVA descontable no se capitaliza). Redondeado a 2 decimales.
Para el promedio:

```text
cantidad' = cantidad + cantidad_entrada
valor'    = valor    + valor_entrada
promedio' = valor' / cantidad'            (derivado, 6 decimales; no se persiste)
```
Para PEPS, la entrada crea una **capa** nueva (`cantidad_restante = cantidad_entrada`,
`costo_unitario = valor_entrada / cantidad_entrada`, 6 decimales).

### R-INV-003 · Costo de una salida — promedio ponderado
```text
costo_salida = redondear_2( valor × cantidad_salida / cantidad )       (half-up)
si cantidad_salida = cantidad  →  costo_salida = valor                 (la última salida vacía el valor)
valor'    = valor − costo_salida
cantidad' = cantidad − cantidad_salida
```
Se **persiste el valor total**, no el promedio: así el redondeo no acumula deriva y el saldo final es
exactamente 0.

**Kardex de referencia (fixture):** compras de 200 × 10.000 y 100 × 11.000; luego ventas de 120, 70 y 110.

| # | Movimiento | Cantidad | Costo mov. | Saldo cant. | Saldo valor | Promedio derivado |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Compra 200 × 10.000 | +200 | 2000000,00 | 200 | 2000000,00 | 10000,000000 |
| 2 | Compra 100 × 11.000 | +100 | 1100000,00 | 300 | 3100000,00 | 10333,333333 |
| 3 | Venta | −120 | 1240000,00 | 180 | 1860000,00 | 10333,333333 |
| 4 | Venta | −70 | 723333,33 | 110 | 1136666,67 | 10333,333364 |
| 5 | Venta (vacía el saldo) | −110 | 1136666,67 | 0 | 0,00 | — |

El promedio derivado del movimiento 4 difiere en el 8.º decimal por el redondeo del valor a centavos; es
esperado. El movimiento 5 toma el **valor remanente** (1.136.666,67), no `110 × 10.333,333333`
(= 1.136.666,66).

### R-INV-016 · Costeo PEPS (FIFO) con capas
Las salidas consumen las capas **en orden de entrada** (la más antigua primero):

```text
pendiente = cantidad_salida
para cada capa en orden (fecha de entrada, id) con cantidad_restante > 0:
    toma = min(capa.cantidad_restante, pendiente)
    costo += redondear_2(toma × capa.costo_unitario)       (la última toma de la capa usa su valor remanente)
    registrar consumo (movimiento, capa, toma, costo_unitario)
    capa.cantidad_restante −= toma ;  pendiente −= toma
si pendiente > 0 → stock insuficiente (R-INV-007)
```
- Cada consumo se guarda en `inventory.cost_layer_consumption` (**solo inserción**, principio I); la
  `cantidad_restante` de la capa es un saldo derivado, mantenido bajo bloqueo en la misma transacción.
- Las devoluciones restituyen **sobre las capas exactas** que se consumieron (R-INV-042).

**Mismo ejemplo con PEPS** (compras 200 × 10.000 y 100 × 11.000; ventas 120, 70 y 110):

| # | Movimiento | Capas consumidas | Costo mov. | Saldo cant. | Saldo valor |
|---:|---|---|---:|---:|---:|
| 1 | Compra 200 × 10.000 | — | 2000000,00 | 200 | 2000000,00 |
| 2 | Compra 100 × 11.000 | — | 1100000,00 | 300 | 3100000,00 |
| 3 | Venta 120 | 120 de la capa 1 (@10.000) | 1200000,00 | 180 | 1900000,00 |
| 4 | Venta 70 | 70 de la capa 1 (@10.000) | 700000,00 | 110 | 1200000,00 |
| 5 | Venta 110 | 10 capa 1 (@10.000) + 100 capa 2 (@11.000) | 1200000,00 | 0 | 0,00 |

Costo de ventas total PEPS = 3.100.000 (igual al total comprado: el inventario final es 0). Comparación con
el promedio, mismo inventario final pero **otra distribución** del costo entre ventas:

| Venta | Costo promedio | Costo PEPS |
|---:|---:|---:|
| 1 (120 und) | 1.240.000,00 | 1.200.000,00 |
| 2 (70 und) | 723.333,33 | 700.000,00 |
| 3 (110 und) | 1.136.666,67 | 1.200.000,00 |
| **Total** | **3.100.000,00** | **3.100.000,00** |

### R-INV-017 · Política de despacho físico y separación entre costo y flujo físico
`picking_policy` decide **qué unidad/lote** se propone para despachar; no cambia el método de costeo:

| Política | Criterio | Uso |
|---|---|---|
| `FEFO` | Primero que vence, primero que sale | **Por defecto** en ítems con vencimiento |
| `FIFO` | Primero en entrar, primero en salir | Por defecto en el resto |
| `LIFO` | Último en entrar, primero en salir | Materiales a granel o apilados donde sacar lo último es lo físicamente posible. **Solo despacho; NO afecta el costeo** |
| `MANUAL` | Elige el operador | Casos especiales, con permiso |

- El costo registrado de la salida **siempre** proviene de R-INV-003 o R-INV-016, sea cual sea la política.
- **Advertencia obligatoria:** al configurar `LIFO` el sistema muestra: «UEPS es solo una política de despacho
  físico. El costo financiero se registra en PEPS o Promedio Ponderado (NIIF y Estatuto Tributario)».
- En ítems perecederos con `FEFO`, el lote físico despachado puede no coincidir con la capa PEPS consumida
  (por ejemplo, un lote recibido después pero que vence antes). Es válido: el costo sigue el flujo PEPS y la
  trazabilidad sigue el lote físico. Si la discrepancia supera un umbral configurable, se genera una alerta
  para revisión del contador 🔶.

### R-INV-018 · El método de costeo no cambia con movimientos existentes
`costing_method` es inmutable **una vez que el ítem tiene movimientos**. Cambiarlo es un cambio de política
contable (NIIF para las Pymes, Sección 10) y requiere un procedimiento asistido y la aprobación del contador:
se emite un comprobante de reexpresión del valor del inventario. **Fuera del MVP**; mientras tanto, el
sistema rechaza el cambio con `COSTING_METHOD_LOCKED`.
- **Estado:** 🔶

## 4. Reglas generales de movimientos (vigentes)

### R-INV-004 · Movimientos inmutables
Un movimiento no se edita ni se borra. Una corrección es un **movimiento inverso** que referencia al original
(`reversal_of`). El kardex es solo de inserción; `running_quantity` y `running_value` se escriben en el mismo
momento del movimiento, con el costo del ítem bloqueado.

### R-INV-005 · Devoluciones
Las devoluciones (en ventas y a proveedores) se rigen por R-INV-040 a R-INV-046. Principio común: el
inventario **reingresa o sale al costo con el que se movió originalmente**, no al costo del día.

### R-INV-006 · Movimientos con fecha anterior (retroactivos)
Un movimiento con fecha anterior al último movimiento del ítem cambia el costo de las salidas posteriores
(en promedio) o la asignación de capas (en PEPS). Política:
1. En **período cerrado**: prohibido (R-CON-004).
2. En **período abierto**: requiere el permiso `inventory.backdate`; se registra y un trabajo de
   **revaluación** recalcula las salidas posteriores y genera **un comprobante de ajuste** por la diferencia
   en costo de ventas e inventario (con contraasientos: nada se edita, principio I). Es determinista e idempotente.
3. Mientras corre, el ítem no admite nuevas salidas.

### R-INV-007 · Stock negativo
Por defecto **no** se permite vender más de lo que hay: la emisión falla con `INSUFFICIENT_STOCK`. Una bodega
puede permitirlo (`allows_negative_stock`); la salida se valora al último costo conocido y, al reponer, se
reconoce la diferencia de costo (ajuste automático) 🔶. No aplica a ítems con `FIFO` y lotes perecederos
(nunca se permite stock negativo).

### R-INV-008 · Traslados entre bodegas
Dos movimientos (`TRANSFER_OUT` y `TRANSFER_IN`) con el mismo costo, creados en la misma transacción. Variante
en dos pasos: despacho (salida de origen a «en tránsito») y recepción. Sin efecto en resultados. En PEPS, las
capas viajan con el traslado conservando su fecha y costo.

### R-INV-009 · Lotes y vencimientos
- Si el ítem `tracks_lots`: toda entrada exige lote (código; fecha de vencimiento si `tracks_expiry`) y toda
  salida identifica el lote.
- Política de despacho por defecto: `FEFO` (R-INV-017); los lotes vencidos no se venden.
- Reporte de próximos a vencer y de vencidos (con destino a merma, R-INV-010).

### R-INV-010 · Deterioro, merma y valor neto realizable
Periódicamente se compara el costo con el valor neto realizable; si es menor se reconoce deterioro. Las
mermas (avería, vencimiento) se registran con `ADJUST_OUT` y su contrapartida en gasto. **Deterioro
periódico: fuera del MVP**; la merma puntual sí está dentro (R-INV-041).

### R-INV-011 · Ajustes por toma física
Faltantes y sobrantes se ajustan al costo del ítem (promedio vigente o capas PEPS), con comprobante propio,
motivo obligatorio y permiso (`inventory.adjust`). Contabilización: contra una cuenta de gasto (faltante) o
ingreso (sobrante) configurable (`posting_rule`). Los **recuentos forzosos por clase ABC** (R-INV-022)
producen estos ajustes.

### R-INV-012 · Tipos de ítem
| Tipo | Controla stock | Comportamiento |
|---|---|---|
| `SIMPLE` | Sí | Normal |
| `SERVICE` | No | Nunca genera movimientos |
| `KIT` | No (compuesto) | Al vender, descuenta el stock de sus componentes a su propio costo |
| `VARIANT_PARENT` | No | Agrupa variantes (talla, color…) |
| `VARIANT` | Sí | Se comporta como `SIMPLE` |

### R-INV-013 · Reservas y disponibilidad
Un pedido web o de venta **reserva** stock con vencimiento (TTL). La factura consume la reserva.
`disponible = on_hand − reservado` en bodegas vendibles; la vitrina y las integraciones consultan el
**disponible**. Una reserva vencida se libera por un trabajo programado.

### R-INV-014 · Unidades de medida
Cantidades en la unidad base del ítem. Presentaciones alternativas con factor de conversión exacto
(`numeric`); las cantidades se convierten a unidad base al registrar el movimiento.

### R-INV-015 · Conciliación inventario–contabilidad
Para cada cuenta de inventario del plan, la suma de los valores del inventario (promedio: `total_value`;
PEPS: Σ `cantidad_restante × costo_unitario`) es igual al saldo contable a la misma fecha. Un trabajo diario lo
comprueba y alerta; es condición para el cierre mensual (R-CON-011).

## 5. Clasificación ABC (rotación y valor)

### R-INV-020 · Cálculo de la clasificación
La clasificación combina **valor** y **rotación** en dos pasos. Parámetros por tenant (valores por defecto
entre paréntesis): ventana `W` (12 meses), umbrales de Pareto `pA` (80 %) y `pB` (95 %), rotación alta `rotH`
(6,0 vueltas/año) y baja `rotL` (2,0 vueltas/año).

**Paso 1 — Pareto por valor de consumo anual.**
```text
Vi   = Σ costo de ventas del ítem i en la ventana W (neto de devoluciones, al costo registrado)
orden: Vi descendente (desempate: código del ítem ascendente)
acum_previo_i = Σ Vj de los ítems ubicados antes que i, dividido entre ΣV
Pareto(i) = A si acum_previo_i < pA ; B si acum_previo_i < pB ; C en otro caso
```
Se usa el acumulado **previo**: el ítem que cruza el umbral queda en la clase en la que empieza.

**Paso 2 — Rotación (guardia).**
```text
vueltas_i = Vi / valor promedio del inventario del ítem i en la ventana W
rotación(i) = ALTA si vueltas_i ≥ rotH ; BAJA si vueltas_i < rotL ; MEDIA en otro caso
```

**Clase final (matriz):**

| Pareto \ Rotación | ALTA | MEDIA | BAJA |
|---|---|---|---|
| **A** | **A** | **A** | B |
| **B** | B | B | B |
| **C** | B | C | C |

- **A** = alto valor **y** rotación no baja; **C** = bajo valor **y** rotación no alta; **B** = valor o rotación
  moderados y las combinaciones mixtas (alto valor con baja rotación, bajo valor con alta rotación).
- Ítems sin historial suficiente (menos de 90 días con movimientos): clase provisional `B` marcada `NEW`.
- Ítems con valor 0 en la ventana: `C` con la marca `SIN_ROTACION`.
- Es un **criterio de negocio** configurable (🔶 para el contador solo en lo que afecte la valuación; no es
  una regla normativa).

**Ejemplo (valores de consumo anual en COP; total = 106.000.000):**

| Ítem | Vi | % del total | Acum. previo | Pareto | Vueltas | Rotación | **Clase final** |
|---|---:|---:|---:|---|---:|---|---|
| P01 | 48000000 | 45,28 % | 0,00 % | A | 8,0 | ALTA | **A** |
| P02 | 30000000 | 28,30 % | 45,28 % | A | 6,0 | ALTA | **A** |
| P03 | 9000000 | 8,49 % | 73,58 % | A | 1,5 | BAJA | **B** (alto valor, baja rotación) |
| P04 | 7000000 | 6,60 % | 82,08 % | B | 3,5 | MEDIA | **B** |
| P05 | 5000000 | 4,72 % | 88,68 % | B | 5,0 | MEDIA | **B** |
| P06 | 2500000 | 2,36 % | 93,40 % | B | 2,5 | MEDIA | **B** |
| P07 | 1800000 | 1,70 % | 95,75 % | C | 12,0 | ALTA | **B** (bajo valor, alta rotación) |
| P08 | 1200000 | 1,13 % | 97,45 % | C | 3,0 | MEDIA | **C** |
| P09 | 900000 | 0,85 % | 98,58 % | C | 1,0 | BAJA | **C** |
| P10 | 600000 | 0,57 % | 99,43 % | C | 1,0 | BAJA | **C** |

### R-INV-021 · Frecuencia y estabilidad
La clasificación se recalcula **mensualmente** (trabajo programado) y bajo demanda. Para evitar «saltos» de
una clase a otra por ruido, un ítem solo **baja** de clase tras **dos** cálculos consecutivos que lo
ubiquen en la clase inferior; sube de inmediato. Cada cambio queda registrado (historial) y emite el evento
`inventory.abc.reclassified`.

### R-INV-022 · Políticas por clase
Valores por defecto, configurables por tenant:

| Aspecto | A | B | C |
|---|---|---|---|
| Recuento (conteo cíclico) | **Mensual, forzoso** | Trimestral | Semestral |
| Alertas de stock | **Tiempo real** (evento al cruzar el ROP o el mínimo) | Diarias (resumen) | Semanales |
| Nivel de servicio objetivo (R-INV-032) | 98 % | 95 % | 90 % |
| Ajustes por diferencia de conteo | Requieren aprobación de un segundo usuario | Aprobación si superan un umbral | Automáticos bajo umbral |
| Reposición | Cálculo individual con ROP | Cálculo con ROP | Simplificada: mínimo/máximo fijos o doble caja |

- Los recuentos se generan como **tareas de conteo** (`cycle_count_task`) con la lista de ítems y bodega; un
  conteo vencido de clase A emite alerta bloqueante configurable: puede impedir el **cierre del período**
  (R-CON-011) hasta que se realice o se justifique.
- La diferencia entre conteo y sistema genera el ajuste de R-INV-011.

### R-INV-023 · Auditoría de ítems de clase A
Todo movimiento manual (ajuste, traslado manual, retroactivo) sobre un ítem de clase A queda marcado en la
bitácora con el motivo y el usuario; el reporte de **excepciones de clase A** se revisa en el cierre mensual.

## 6. Punto de reorden y stock de seguridad (JIT)

Se calcula por ítem (y opcionalmente por bodega):

$$ROP = (d \times L) + SS$$

donde $d$ es la demanda promedio diaria, $L$ el *lead time* del proveedor en días y $SS$ el stock de
seguridad.

### R-INV-030 · Demanda promedio diaria $d$
- **Datos:** salidas por venta netas de devoluciones (`SALE_OUT − RETURN_IN`) por día calendario, en una
  ventana móvil de `Wd` días (por defecto 90). Los traslados y ajustes **no** son demanda.
- Se **excluyen** los días en que el disponible fue 0 todo el día (la demanda no pudo manifestarse: se
  subestimaría).
- `d` = media de la demanda diaria de los días incluidos; `σd` = desviación estándar muestral de esos días.
- Si hay menos de 30 días válidos, se usa la demanda manual del ítem (`manual_daily_demand`) y se marca
  `LOW_CONFIDENCE`.

### R-INV-031 · Lead time $L$
Tiempo en días entre la fecha de la orden de compra y la fecha de recepción. `L` = promedio de las últimas `N`
recepciones del ítem con ese proveedor (por defecto 5); `σL` su desviación estándar. Si no hay historial,
`item_supplier.lead_time_days` (valor pactado).

### R-INV-032 · Stock de seguridad $SS$
$$SS = z \cdot \sqrt{L\,\sigma_d^{2} + d^{2}\,\sigma_L^{2}}$$

con $z$ el valor de la distribución normal estándar para el nivel de servicio objetivo. Si el *lead time* se
considera constante ($\sigma_L = 0$) se reduce a $SS = z\,\sigma_d\sqrt{L}$.

| Nivel de servicio | 90 % | 95 % | 97,5 % | 98 % | 99 % |
|---|---:|---:|---:|---:|---:|
| $z$ | 1,2816 | 1,6449 | 1,9600 | 2,0537 | 2,3263 |

Niveles por defecto según la clase ABC (R-INV-022): A 98 %, B 95 %, C 90 %. Para unidades contables,
$SS$ y $ROP$ se **redondean hacia arriba** al entero; para unidades fraccionarias, a 4 decimales.

**Ejemplo 1** (clase B, 95 %, $L$ constante): $d = 20$, $L = 7$, $\sigma_d = 6$, $z = 1{,}645$.
$SS = 1{,}645 \times 6 \times \sqrt{7} = 26{,}11 \to 27$; $ROP = 20 \times 7 + 27 = 167$.

**Ejemplo 2** (mismo ítem con $\sigma_L = 2$ días):
$SS = 1{,}645 \times \sqrt{7 \times 36 + 400 \times 4} = 1{,}645 \times 43{,}04 = 70{,}79 \to 71$;
$ROP = 140 + 71 = 211$.

**Ejemplo 3** (clase A, 98 %, $L$ constante): $SS = 2{,}0537 \times 6 \times \sqrt{7} = 32{,}60 \to 33$;
$ROP = 140 + 33 = 173$.

### R-INV-033 · Posición de inventario y disparo
```text
posición = disponible + cantidad pendiente en órdenes de compra abiertas
alerta  ⇔  posición ≤ ROP
```
Ejemplo (ROP = 167): disponible 150 y 40 en una orden de compra en camino ⇒ posición 190 > 167, **sin alerta**;
sin orden en camino ⇒ posición 150 ≤ 167, **alerta**.

### R-INV-034 · Alertas y sugerencia de reposición
- Al cruzar el punto de reorden se emite `inventory.reorder.required` (webhook y notificación) con el ítem,
  la posición, el ROP y la cantidad sugerida; no se crea una orden de compra automática salvo configuración.
- **Cantidad sugerida** = `max(0, nivel_máximo − posición)` con `nivel_máximo = ROP + d × ciclo_de_pedido`
  (días entre pedidos, por defecto 14). Ejemplo: ROP 167, d = 20, ciclo 14 ⇒ máximo 447; con posición 150 ⇒
  sugerido 297.
- **JIT:** el stock de seguridad de ítems clase C se mantiene mínimo; reducir $L$ (mejor proveedor) o
  $\sigma_d$ reduce $SS$ directamente y el reporte lo muestra como oportunidad.
- El cálculo se refresca diariamente y al registrar una recepción; el valor usado queda en el evento para
  auditar por qué se alertó.

## 7. Devoluciones (RMA) en ventas y a proveedores

### R-INV-040 · Elegibilidad y límites de una devolución en venta
- Solo sobre **líneas de una factura aceptada** (R-FE-009); la nota crédito referencia su CUFE.
- Cantidad devuelta acumulada de una línea ≤ cantidad vendida. Si se devuelve el total de todas las líneas, es
  una **devolución total** (concepto «anulación» de la nota crédito); en otro caso es **parcial**.
- Ventana máxima de devolución en días (configurable; `RETURN_WINDOW_EXPIRED`); la excepción requiere
  permiso `sales.return.override`.
- Cada línea devuelta declara su **condición**: `RESELLABLE` (disponible), `DAMAGED` (avería/merma) o
  `EXPIRED`.

### R-INV-041 · Reingreso físico según el estado del producto
| Condición | Reingresa a | Efecto en disponible | Después |
|---|---|---|---|
| `RESELLABLE` | Bodega de origen (o la vendible indicada) | **Aumenta** | — |
| `DAMAGED` | Bodega tipo `DAMAGED` (avería) | **No** aumenta | Pendiente de decisión: merma (baja contra gasto) o devolución al proveedor |
| `EXPIRED` | Bodega tipo `DAMAGED` | No aumenta | Merma |

El reingreso es un movimiento `RETURN_IN` por cada línea. Si la política es `write_off_on_return = true`, en
la misma transacción se registra la baja (`ADJUST_OUT`) de lo averiado/vencido con su gasto.

### R-INV-042 · Costo del reingreso
- **Promedio:** entra al costo con el que **salió** (`unit_cost_at_sale` de la línea); el nuevo promedio es el
  de R-INV-002 con ese valor. Ejemplo: 2 unidades a costo 60.000 ⇒ valor de reingreso 120.000.
- **PEPS:** se restituye la `cantidad_restante` de **las capas exactas** de las que se consumió (guardadas en
  `cost_layer_consumption`), en orden inverso al consumo.

**Ejemplo PEPS:** capa 1 (200 @ 10.000) y capa 2 (100 @ 11.000); venta de 120 consume 120 de la capa 1
(restan 80). Se devuelven 20 *vendibles*: la capa 1 pasa a 100 y el valor del inventario sube 200.000
(20 × 10.000). Saldo: 100 @ 10.000 + 100 @ 11.000 = 2.100.000.

### R-INV-043 · Efecto contable, fiscal y de cartera de la nota crédito
En **la misma transacción** (principio III) que la nota crédito:

1. **Inventario:** R-INV-041/042.
2. **Contabilidad:** reversa proporcional de ingreso (`4175` devoluciones en ventas), de **IVA generado** y del
   costo de ventas contra inventario (plantilla P-02 y P-11).
3. **Retenciones sufridas:** si la factura ya tuvo retenciones reconocidas en un recibo, se reversan en
   proporción (el cliente ajusta su retención) 🔶 — decisión pendiente del contador.
4. **Cartera:**
   - factura **sin pagar**: reduce el saldo de la factura;
   - factura **pagada**: genera **saldo a favor** del cliente (anticipo) o una devolución en dinero mediante
     comprobante de egreso;
   - una devolución total deja el saldo de la factura en 0 y libera cupo de crédito (R-CAR-008).
5. **DIAN:** se transmite la nota crédito electrónica con concepto de corrección y referencia al CUFE
   (R-FE-010). El inventario y el asiento se registran al emitir (igual que la factura, ADR-0006); si la DIAN
   rechaza, se corrige conservando el número.

### R-INV-044 · Idempotencia y atomicidad
La emisión de una nota crédito acepta `Idempotency-Key`; ante fallo, **nada** queda a medias (ni movimiento de
stock, ni asiento, ni número consumido).

### R-INV-045 · Devolución a proveedor
Documento `PURCHASE_RETURN` sobre líneas de una compra recibida (o sin referencia con permiso especial):
- **Salida de kardex al costo correspondiente:** promedio ⇒ al costo de la compra original (la diferencia
  frente al promedio vigente queda reflejada en el nuevo promedio, 🔶); PEPS ⇒ desde la capa de esa entrada.
  Si esa capa ya se consumió parcialmente, la salida se limita a su `cantidad_restante` y el resto exige
  ajuste explícito.
- **Cuentas por pagar:** reduce la cuenta del proveedor (nota crédito del proveedor); si ya se pagó, genera
  saldo a favor/anticipo (`1330`) o cobro de reembolso.
- **Contabilidad:** `Dr Proveedores / Cr Inventario / Cr IVA descontable (reversa)` y reversa proporcional
  de retenciones practicadas (plantilla P-12).
- **DIAN:** el proveedor emite la nota crédito electrónica; SIFCA la registra y la asocia. Si el proveedor es
  no obligado a facturar y se usó **documento soporte**, se emite su **nota de ajuste** (R-FE-014).

### R-INV-046 · Bodega de avería y trazabilidad por lote
Las bodegas tienen un tipo (`MAIN`, `DAMAGED`, `QUARANTINE`, `TRANSIT`). Solo `MAIN` suma al disponible. El
reingreso de un ítem con lotes conserva el **lote original** de la venta; un lote vencido o averiado no se
vuelve a poner a la venta (R-INV-009).

## 8. Reportes mínimos

| Reporte | Contenido |
|---|---|
| Kardex por ítem | Campos de R-INV-003/016 con filtros por bodega, lote y rango de fechas; muestra el método de costeo |
| Existencias valoradas a una fecha | Cantidad, valor y costo por ítem y bodega |
| Clasificación ABC | Pareto, rotación, clase final y cambios (R-INV-020/021) |
| Conteos cíclicos y diferencias | Tareas, resultados y ajustes (R-INV-022) |
| Reposición | ROP, posición, sugerido y niveles de servicio (R-INV-030…034) |
| Próximos a vencer / mermas | Por lote (R-INV-009, R-INV-041) |
| Devoluciones | Por motivo, condición y cliente/proveedor (R-INV-040…045) |
| Conciliación con contabilidad | R-INV-015 |

## 9. Concurrencia (resumen)

Descontar stock bloquea, en orden determinista `(item_id, warehouse_id, lot_id)`, las filas de
`stock_balance`, de `item_cost` (promedio) o de las capas afectadas (PEPS); luego escribe el movimiento y los
consumos y actualiza los saldos en la misma transacción que emite el documento. Detalle en
`01-arquitectura/02-modelo-de-datos-preliminar.md` §4.
