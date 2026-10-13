# Cartera, cuentas por pagar y préstamos

Estado de verificación: ver [`README.md`](README.md). Los cálculos numéricos están verificados por cómputo
exacto; las citas normativas son 🔶 hasta validación del contador.

## Parte A — Cartera (CxC) y cuentas por pagar (CxP)

### A.1 Marco

| Norma | Aporta | Estado |
|---|---|---|
| NIIF para las Pymes, Sección 11 (instrumentos financieros básicos) | Medición y **deterioro** de cuentas por cobrar | 🔶 |
| Código de Comercio art. 884 y 886 | Interés comercial, límite de usura, restricción a capitalizar intereses | 🔶 |
| Código Penal art. 305 | Tipifica la usura | 🔶 |
| Ley 1231 de 2008 y Ley 1676 de 2013 | Factura como título valor (relevante para cobro y para eventos RADIAN, fuera del MVP) | 🔶 |

### A.2 Reglas de cartera

#### R-CAR-001 · La cartera se deriva del libro mayor, no de un saldo aparte
El saldo de un cliente es la suma de las líneas de las cuentas de deudores (`requires_party`) de ese tercero,
neta de recibos, notas crédito y anticipos. No existe una columna «saldo» editable. Los reportes de cartera
**deben cuadrar** con el saldo de las cuentas de clientes del mayor a la misma fecha (conciliación diaria,
condición de cierre mensual).

#### R-CAR-002 · Plazos y vencimiento
Una factura a crédito tiene `due_date = fecha_emisión + plazo` (en días calendario). Condiciones de pago
(`contado`, 15, 30, 45, 60… días) son un catálogo por empresa; la forma de pago viaja a la factura
electrónica (R-FE-005).

#### R-CAR-003 · Aplicación de recibos
Un recibo de caja aplica su valor a una o más facturas (`receipt_allocation`). Por defecto se aplica a la
**factura más antigua vencida primero** (orden por `due_date`); el usuario puede elegir manualmente. Un valor
no aplicado queda como **anticipo de cliente** (saldo a favor, cuenta 2805 🔶) que se cruza después.
- **Invariante:** Σ aplicaciones de un recibo ≤ valor del recibo; Σ aplicaciones a una factura ≤ saldo
  pendiente de la factura.

#### R-CAR-004 · Retenciones sufridas en el recibo
El recibo puede incluir retenciones practicadas por el cliente (ReteFuente, ReteIVA, ReteICA): se registran
como activo (impuesto a favor, P-04) y **reducen el saldo** de la factura como pago en especie. El valor neto
recibido en banco es `valor_aplicado − retenciones`.

#### R-CAR-005 · Notas crédito
Una nota crédito se aplica a la factura que referencia (R-FE-010); si la factura ya estaba pagada, genera un
saldo a favor del cliente (anticipo o devolución en dinero mediante comprobante de egreso).

#### R-CAR-006 · Edades de cartera
Antigüedad medida en días desde el **vencimiento** a una fecha de corte. Rangos por defecto (configurables):

| Rango | Condición |
|---|---|
| Por vencer | `corte ≤ due_date` |
| 1–30 | `1 ≤ corte − due_date ≤ 30` |
| 31–60 | `31 … 60` |
| 61–90 | `61 … 90` |
| 91–180 | `91 … 180` |
| Más de 180 | `> 180` |

**Ejemplo:** factura con vencimiento 2026-08-31, corte 2026-10-13 ⇒ 43 días de mora ⇒ rango 31–60.
La fecha de corte permite reproducir un reporte histórico: el estado a una fecha se calcula con los
movimientos hasta esa fecha, no con el estado actual.

#### R-CAR-007 · Intereses de mora
Se calculan solo si la empresa los tiene habilitados y el cliente los acepta (condición pactada). Tasa de
mora = **menor** entre la pactada y el límite de usura vigente (R-PRE-008). Se calcula sobre el **capital
vencido**, desde el día siguiente al vencimiento, con base 365 y **sin capitalizar** (no se cobran intereses
sobre intereses de mora salvo lo que permita la ley, CCo art. 886 🔶). Se emiten como **nota débito** con el
concepto «intereses» (R-FE-010).
- **Ejemplo (tasa EA 30 %, capital vencido $1.000.000, 45 días):**
  `1.000.000 × ((1,30)^(45/365) − 1) = $32.875,11`. (Con tasa nominal simple daría $36.986,30: el método
  debe quedar fijado en la configuración y auditado.)

#### R-CAR-008 · Cupo de crédito y bloqueo
Cada cliente tiene un cupo (`credit_limit`). Una factura a crédito que haría superar cupo, o a un cliente con
cartera vencida mayor a X días, requiere autorización con permiso (`sales.credit.override`) y queda registrada.

#### R-CAR-009 · Gestión de cobranza
- Cada gestión (llamada, correo, WhatsApp, visita) se registra con resultado y, si lo hay, **compromiso de
  pago** (fecha y valor).
- Estados del cliente en cobranza: `AL_DIA`, `EN_GESTION`, `COMPROMISO`, `INCUMPLIDO`, `JURIDICO`.
- Recordatorios automáticos (antes del vencimiento, el día, y tras X días) por el worker; **sólo a canales
  con autorización del titular** (Ley 1581 de 2012 🔶) y con opción de baja.
- Estado de cuenta: PDF por cliente (renderizado con Asia-POP) con facturas pendientes, vencidas y saldo.

#### R-CAR-010 · Deterioro de cartera
Política de provisión por rangos de edad (porcentajes configurables) o evaluación individual 🔶. Genera
comprobante de provisión (gasto contra la cuenta de provisiones de deudores, grupo 13 🔶) y se reversa al
recuperar. **Fuera del MVP**; el modelo no lo impide.

#### R-CAR-011 · Castigo de cartera
Retiro de una cuenta incobrable: requiere autorización, soporte de gestión y sigue la política fiscal (ET
deducibilidad de deudas de dudoso o difícil cobro 🔶). **Fuera del MVP.**

### A.3 Reglas de cuentas por pagar

#### R-CAR-020 · Registro y causación
La factura de proveedor (o documento soporte) causa el gasto/inventario, el IVA descontable, las retenciones
practicadas y la cuenta por pagar (P-05, P-06). El vencimiento se calcula por el plazo pactado.

#### R-CAR-021 · Pago a proveedores
El **comprobante de egreso** aplica a una o más cuentas por pagar y genera el asiento Dr Proveedores / Cr
Bancos (P-07). Calendario de pagos: ordenado por vencimiento, con descuentos por pronto pago si aplican.

#### R-CAR-022 · Certificados de retención practicada
El sistema produce el certificado anual por tercero y concepto con base en las líneas de las cuentas de
retención por pagar (R-IMP-013).

#### R-CAR-023 · Cuentas por pagar no se saldan sin soporte
Un egreso exige referencia al documento causado. Los pagos anticipados a proveedores se registran como
**anticipos** (1330 🔶) y se cruzan con la factura cuando llega.

---

## Parte B — Préstamos y financiamiento

### B.1 Alcance (ver Q-11)

`loan.direction` admite dos sentidos:

| Dirección | Significado | Contabilidad típica |
|---|---|---|
| `RECEIVED` | La empresa recibe un crédito (banco, tercero) | Pasivo: obligaciones financieras (2105), gasto financiero (5305) |
| `GRANTED` | La empresa presta a un tercero (empleado, socio, cliente) | Activo: préstamos a particulares (1370), ingreso financiero (4210) |

> **Advertencia (Q-11):** prestar dinero de forma habitual y profesional como actividad económica puede
> implicar supervisión y obligaciones regulatorias; los préstamos entre la empresa y sus socios o
> trabajadores tienen reglas fiscales propias (p. ej. intereses presuntos, ET art. 35 🔶). El MVP solo
> garantiza el **cálculo y la contabilización**; la viabilidad regulatoria del negocio es decisión del
> cliente con su asesor.

### B.2 Reglas

#### R-PRE-001 · Datos mínimos de un préstamo
Principal, tasa y su base (`NOMINAL_PERIOD` o `EFFECTIVE_ANNUAL`), sistema de amortización, número de
periodos, periodicidad, fecha de desembolso, tercero, y política de mora. Con ellos el cronograma se
**calcula de forma determinista** y se guarda (`loan_schedule_item`); no se recalcula salvo evento
(abono extraordinario, refinanciación).

#### R-PRE-002 · Conversión de tasas
```text
tasa_periódica = (1 + EA)^(días_periodo/365) − 1       para tasa efectiva anual
               = nominal_anual / periodos_por_año      para tasa nominal con capitalización por periodo
EA             = (1 + tasa_periódica)^(periodos_por_año) − 1
```
**Ejemplos:** 1,5 % mensual ⇒ EA = **19,5618 %**; EA 24 % ⇒ mensual = **1,8088 %** (para periodicidad mensual
se usa `1/12`, no días). Las tasas se guardan con 10 decimales y se redondean solo al calcular valores en
pesos.

#### R-PRE-003 · Sistemas de amortización
| Sistema | Característica | Fórmula |
|---|---|---|
| `FIXED_PAYMENT` (francés) | Cuota constante; interés decreciente, capital creciente | `cuota = P·i / (1 − (1+i)^−n)` |
| `FIXED_PRINCIPAL` (alemán) | Capital constante; cuota decreciente | `capital = P/n`; `interés_k = saldo_{k−1}·i` |
| `BULLET` | Solo intereses periódicos y capital al vencimiento | `interés = P·i`; capital en la última cuota |

#### R-PRE-004 · Redondeo y última cuota
Cuota, interés y capital se redondean a 2 decimales (*half-up*, R-CON-009) **por periodo**. La **última cuota
absorbe el residuo** para dejar saldo exactamente 0 (capital de la última = saldo pendiente).

**Ejemplo A — cuota fija:** P = 10.000.000, i = 1,5 % mensual, n = 12.
Cuota = **916.799,93**.

| # | Interés | Capital | Cuota | Saldo |
|---:|---:|---:|---:|---:|
| 1 | 150000,00 | 766799,93 | 916799,93 | 9233200,07 |
| 2 | 138498,00 | 778301,93 | 916799,93 | 8454898,14 |
| 3 | 126823,47 | 789976,46 | 916799,93 | 7664921,68 |
| … | … | … | … | … |
| 11 | 26897,31 | 889902,62 | 916799,93 | 903251,15 |
| 12 | 13548,77 | 903251,15 | **916799,92** | 0,00 |

Total intereses **1.001.599,15**; total pagado **11.001.599,15**. (La cuota 12 es un centavo menor por el
ajuste de residuo.)

**Ejemplo B — capital constante:** P = 10.000.000, i = 1,5 %, n = 12; capital base = 833.333,33.

| # | Interés | Capital | Cuota | Saldo |
|---:|---:|---:|---:|---:|
| 1 | 150000,00 | 833333,33 | 983333,33 | 9166666,67 |
| 2 | 137500,00 | 833333,33 | 970833,33 | 8333333,34 |
| 3 | 125000,00 | 833333,33 | 958333,33 | 7500000,01 |
| … | … | … | … | … |
| 12 | 12500,00 | **833333,37** | 845833,37 | 0,00 |

Total intereses **975.000,00**; total pagado **10.975.000,00**. El capital de la última cuota (833.333,37)
absorbe los centavos de redondeo.

**Ejemplo C — bullet:** interés mensual = 10.000.000 × 1,5 % = **150.000,00** durante 11 meses; en el mes 12
se paga 10.150.000,00.

#### R-PRE-005 · Pagos y orden de imputación
Un pago se imputa, por defecto, en este orden: **(1)** gastos y cargos, **(2)** intereses de mora,
**(3)** intereses corrientes vencidos, **(4)** capital vencido, **(5)** capital por vencer. El orden es
configurable por préstamo y se muestra en el recibo. Pago parcial de una cuota deja la cuota en estado
`PARCIAL`.

#### R-PRE-006 · Abonos extraordinarios
Dos opciones, elegidas al registrarlo: **(a) reducir plazo** (cuota constante) o **(b) reducir cuota**
(plazo constante). Se recalcula el cronograma restante desde el saldo; el cronograma anterior se conserva en
historial (no se sobrescribe).
- **Ejemplo (a):** tras la cuota 3 del Ejemplo A (saldo 7.664.921,68), abono extraordinario de 2.000.000 ⇒
  saldo 5.664.921,68; con la cuota de 916.799,93 quedan **7 cuotas** (la última de 490.263,87) en vez de 9.

#### R-PRE-007 · Mora
Una cuota impaga genera intereses de mora sobre el **capital vencido** con la tasa de mora del préstamo
(R-CAR-007: menor entre la pactada y la de usura), desde el día siguiente al vencimiento, base 365 y sin
capitalización 🔶. Los intereses de mora se calculan **a la fecha del pago o de corte**, no se pre-generan.

#### R-PRE-008 · Límite de usura
Al crear o refinanciar un préstamo y al aplicar mora, se compara la tasa **efectiva anual** con el límite de
usura vigente, que es **1,5 veces el interés bancario corriente** certificado por la Superintendencia
Financiera para la modalidad correspondiente (CCo art. 884; Código Penal art. 305) 🔶. Si la supera, la
operación se **bloquea** (o se topa en el límite, según la configuración).
- **Modelo:** tabla `lending.reference_rate` (modalidad, tasa certificada, `valid_from`, `valid_to`),
  actualizada mensualmente; **no hay un valor en el código**.
- **Pendiente:** definir con el contador qué cargos adicionales (comisiones, seguros) se incluyen en la tasa
  efectiva a comparar.

#### R-PRE-009 · Contabilización
Ver §B.4. Cada desembolso, causación y pago genera comprobantes con tercero obligatorio (R-CON-008).

#### R-PRE-010 · Estados del préstamo
`DRAFT → ACTIVE → (PAID | DEFAULTED | REFINANCED | CANCELLED)`. Un préstamo `ACTIVE` no cambia sus
condiciones; modificarlas es una **refinanciación** (nuevo préstamo referenciando al anterior).

### B.3 Datos del cronograma que consume la cartera
Las cuotas por cobrar de un préstamo `GRANTED` entran a los **reportes de cartera** como una categoría propia
(«cartera de préstamos»), con las mismas edades de R-CAR-006, para que el mayor y los auxiliares cuadren.

### B.4 Plantillas de contabilización

#### Préstamo recibido (`RECEIVED`) — Ejemplo A

| Momento | Débito | Crédito |
|---|---|---|
| Desembolso de 10.000.000 | 1110 Bancos 10000000 | 2105 Obligaciones financieras 10000000 |
| Pago de la cuota 1 (916.799,93) | 2105 Obligaciones 766799,93 · 5305 Gastos financieros (intereses) 150000,00 | 1110 Bancos 916799,93 |

Si la empresa **causa** el interés al cierre del mes aunque no haya pagado: `Dr 5305 / Cr 2105 (subcuenta
intereses por pagar)`, y el pago cancela esa subcuenta en vez de llevar el interés directo al gasto.

#### Préstamo otorgado (`GRANTED`)

| Momento | Débito | Crédito |
|---|---|---|
| Desembolso | 1370 Préstamos a particulares (con tercero) | 1110 Bancos |
| Causación de interés del periodo | 1370 (intereses por cobrar, con tercero) | 4210 Ingresos financieros |
| Cobro de cuota | 1110 Bancos | 1370 (capital e intereses) |

Las retenciones y el tratamiento fiscal de los intereses recibidos dependen del tipo de tercero (R-IMP) 🔶.

### B.5 Pruebas obligatorias del módulo

| Prueba | Criterio |
|---|---|
| Ejemplos A, B y C | El cronograma coincide con las tablas al centavo |
| Invariante de saldo | Σ capital del cronograma = principal; saldo final = 0 |
| Propiedad | Para cualquier principal, tasa y n generados, saldo final 0 y cuotas con 2 decimales |
| Conversión de tasas | `EA → periódica → EA` conserva el valor con precisión de 10 decimales |
| Abono extraordinario | Ejemplo de R-PRE-006 (a) |
| Mora | Ejemplo de R-CAR-007 |
| Usura | Con una tasa de referencia simulada, rechaza una tasa superior y acepta una igual |
