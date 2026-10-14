# Cartera, ventas a crédito y cuentas por pagar

> **Alcance (decisión vigente):** SIFCA **no** otorga ni gestiona préstamos de dinero. Este documento cubre
> **ventas a crédito y cartera**: límite de crédito por cliente, plazos, edades de cartera, recibos y abonos,
> control de mora y bloqueo de despacho por cupo excedido; más las cuentas por pagar.

Estado de verificación: ver [`README.md`](README.md). Los cálculos numéricos están verificados por cómputo
exacto. Los umbrales (80 % de alerta, días de mora para bloquear, rangos de edades) son **parámetros de
negocio configurables por tenant**, no normativa.

## 1. Marco

| Norma o criterio | Aporta | Estado |
|---|---|---|
| NIIF para las Pymes, Sección 11 (instrumentos financieros básicos) | Medición y **deterioro** de cuentas por cobrar | 🔶 |
| Ley 1231 de 2008 y Ley 1676 de 2013 | Factura como título valor (relevante para el cobro; eventos RADIAN fuera del MVP) | 🔶 |
| Ley 1581 de 2012 | Tratamiento de datos personales: recordatorios y gestión de cobranza solo por canales autorizados | 🔶 |
| Decisión de producto | Crédito = **plazo de pago comercial** sobre una factura; no se pacta ni administra financiación | Decisión vigente |

## 2. Ventas a crédito: modelo

| Dato | Dónde vive | Descripción |
|---|---|---|
| `credit_limit` | Tercero (cliente) | Cupo máximo de exposición en COP; `0` o nulo = **sin crédito** (solo contado) |
| `payment_term_days` | Tercero (cliente) | Plazo por defecto en días calendario (0 = contado, 15, 30, 45, 60…) |
| `payment_form` | Documento de venta | `CONTADO` o `CREDITO`; solo `CREDITO` consume cupo |
| `due_date` | Documento de venta | `fecha de emisión + plazo` |
| Estado de crédito | Derivado (R-CAR-014) | `AL_DIA`, `ALERTA`, `BLOQUEADO_CUPO`, `BLOQUEADO_MORA`, `SUSPENDIDO` |

Flujo resumido de una venta a crédito:

```text
pedido ─► [control de crédito] ─► confirmado ─► factura (CREDITO) ─► [control de crédito] ─► despacho
                  │ excede cupo o hay mora                                │ idem
                  └──► CREDIT_HOLD (retenido) ──► liberación con permiso y bitácora
```

## 3. Reglas de cartera (CxC)

### R-CAR-001 · La cartera se deriva del libro mayor, no de un saldo aparte
El saldo de un cliente es la suma de las líneas de las cuentas de deudores (`requires_party`) de ese tercero,
neta de recibos, notas crédito y anticipos. No existe una columna «saldo» editable. Los reportes de cartera
**deben cuadrar** con el saldo de las cuentas de clientes del mayor a la misma fecha (conciliación diaria,
condición de cierre mensual, R-CON-011).

### R-CAR-002 · Plazos y vencimiento
Una factura `CREDITO` tiene `due_date = fecha_emisión + payment_term_days` (días calendario). El plazo se
toma del cliente y puede cambiarse en el documento dentro de los límites que permita el rol. Las
condiciones de pago (`CONTADO`, 15, 30, 45, 60… días) son un catálogo por tenant; la forma de pago viaja a la
factura electrónica (R-FE-005). Una venta de contado **no** consume cupo ni genera cartera.

### R-CAR-003 · Aplicación de recibos y abonos
Un recibo de caja aplica su valor a una o más facturas (`receipt_allocation`). Por defecto se aplica a la
**factura más antigua vencida primero** (orden por `due_date`); el usuario puede elegir manualmente. Los
**abonos parciales** son válidos: la factura queda `PARCIAL` con su saldo. Un valor no aplicado queda como
**anticipo de cliente** (saldo a favor, P-09) que se cruza después.
- **Invariante:** Σ aplicaciones de un recibo ≤ valor del recibo; Σ aplicaciones a una factura ≤ saldo
  pendiente de la factura.
- Un recibo es de solo inserción (principio I): se corrige con un **recibo de reversa**.

### R-CAR-004 · Retenciones sufridas en el recibo
El recibo puede incluir retenciones practicadas por el cliente (ReteFuente, ReteIVA, ReteICA): se registran
como activo (impuesto a favor, P-04) y **reducen el saldo** de la factura como pago en especie. El valor neto
recibido en banco es `valor_aplicado − retenciones`.

### R-CAR-005 · Notas crédito
Una nota crédito se aplica a la factura que referencia (R-FE-010). Si la factura ya estaba pagada, genera un
saldo a favor del cliente o una devolución en dinero (comprobante de egreso). El procedimiento completo para
devoluciones está en R-INV-043. Una nota crédito **libera cupo** en el mismo momento en que se emite.

### R-CAR-006 · Edades de cartera
Antigüedad medida en días desde el **vencimiento** a una fecha de corte `C`: `mora = máx(0, C − due_date)`.

| Rango | Condición | Etiqueta |
|---|---|---|
| Corriente | `C ≤ due_date` (mora = 0) | Corriente |
| 1–30 | `1 ≤ mora ≤ 30` | 30 |
| 31–60 | `31 ≤ mora ≤ 60` | 60 |
| 61–90 | `61 ≤ mora ≤ 90` | 90 |
| Más de 90 | `mora > 90` | 90+ |

**Ejemplo:** factura con vencimiento 2026-08-31, corte 2026-10-13 ⇒ mora = 43 días ⇒ rango 31–60.
La fecha de corte permite reproducir un reporte histórico: el estado a una fecha se calcula con los
movimientos hasta esa fecha, no con el estado actual.

**Ejemplo de reporte (corte 2026-10-13):**

| Factura | Vence | Saldo | Mora (días) | Rango |
|---|---|---:|---:|---|
| F-101 | 2026-10-30 | 1500000 | 0 | Corriente |
| F-087 | 2026-09-20 | 800000 | 23 | 1–30 |
| F-070 | 2026-08-31 | 2000000 | 43 | 31–60 |
| F-052 | 2026-07-15 | 2200000 | 90 | 61–90 |
| F-031 | 2026-06-01 | 1000000 | 134 | 90+ |
| **Total cartera** | | **7500000** | | |

Totales por rango: Corriente 1.500.000 · 1–30 800.000 · 31–60 2.000.000 · 61–90 2.200.000 · 90+ 1.000.000
(suma 7.500.000, igual al saldo del cliente en el mayor, R-CAR-001).

### R-CAR-007 · Mora: definición y alcance
Una factura está **en mora** cuando tiene saldo y `C > due_date`. La mora se controla mediante estados de
crédito (R-CAR-014), alertas (R-CAR-013) y bloqueos (R-CAR-012).
- **Los intereses de mora no se calculan automáticamente** en el alcance actual. Si la empresa decide cobrar
  intereses, los factura manualmente con una **nota débito** (concepto «intereses», R-FE-010), bajo su
  responsabilidad frente a los topes legales.

### R-CAR-008 · Cupo de crédito y su consumo
```text
exposición = Σ saldo pendiente de facturas y notas débito a CREDITO (vencidas o no)
           + Σ valor total (con IVA) de pedidos CREDITO confirmados y aún no facturados
           − Σ saldos a favor / anticipos del cliente
cupo_disponible = credit_limit − exposición
```
- El cupo se **libera** al recibir abonos, al emitir notas crédito y al cancelar pedidos; se **consume** al
  confirmar un pedido a crédito (reserva de cupo) y se reemplaza por la factura al emitirla (sin doble conteo).
- `credit_limit = 0` o nulo ⇒ el cliente solo compra de contado (`CREDIT_NOT_ALLOWED`).

**Ejemplo:** `credit_limit` 10.000.000; facturas pendientes 6.500.000; pedidos confirmados sin facturar
2.000.000; saldo a favor 500.000 ⇒ exposición = 6.500.000 + 2.000.000 − 500.000 = **8.000.000**; cupo
disponible **2.000.000**. Un pedido nuevo a crédito de 2.500.000 excede el cupo en **500.000** ⇒ se retiene
(R-CAR-012).

### R-CAR-009 · Gestión de cobranza
- Cada gestión (llamada, correo, WhatsApp, visita) se registra con resultado y, si lo hay, **compromiso de
  pago** (fecha y valor).
- Estados de gestión del cliente: `AL_DIA`, `EN_GESTION`, `COMPROMISO`, `INCUMPLIDO`, `JURIDICO`.
- Recordatorios automáticos (antes del vencimiento, el día y tras X días) por el worker, **solo a canales con
  autorización del titular** y con opción de baja.
- Estado de cuenta por cliente (con facturas pendientes, vencidas y saldo) consultable por API y exportable.

### R-CAR-010 · Deterioro de cartera
Política de provisión por rangos de edad (porcentajes configurables) o evaluación individual 🔶. Genera
comprobante de provisión y se reversa al recuperar. **Fuera del MVP**; el modelo no lo impide.

### R-CAR-011 · Castigo de cartera
Retiro de una cuenta incobrable: requiere autorización, soporte de gestión y la política fiscal aplicable 🔶.
**Fuera del MVP.**

### R-CAR-012 · Bloqueo de despacho por cupo excedido o por mora
Un pedido o factura a crédito pasa a **`CREDIT_HOLD`** (retenido) y **no puede avanzar a facturación ni a
despacho** cuando se cumple **cualquiera** de estas condiciones:

| Causa | Condición (valores por defecto) |
|---|---|
| Cupo excedido | `exposición + valor del nuevo documento > credit_limit` |
| Mora | El cliente tiene facturas con mora > `block_days_overdue` (30 días) por un saldo > `block_min_amount` (0) |
| Suspensión manual | `credit_status = SUSPENDIDO` |

- El control se ejecuta en tres puntos: **(1)** al confirmar el pedido a crédito, **(2)** al emitir la factura
  `CREDITO`, **(3)** al liberar el pedido para despacho.
- **Excepciones:** quien tenga el permiso `sales.credit.release` puede liberar el documento indicando un
  **motivo obligatorio**; la liberación queda en la bitácora y emite `credit.hold.released`. Una venta de
  **contado** nunca se retiene por cupo, pero un cliente `BLOQUEADO_MORA` puede comprar de contado.
- La retención **no** modifica ni borra el documento: solo cambia su estado; liberarlo o cancelarlo son
  operaciones explícitas.
- Respuesta de la API: `409 CREDIT_LIMIT_EXCEEDED` o `409 CUSTOMER_BLOCKED_OVERDUE`, con el detalle del
  cálculo (cupo, exposición, excedente).

### R-CAR-013 · Alertas de cartera y de crédito
| Evento | Cuándo | Destino |
|---|---|---|
| `credit.limit.warning` | La exposición alcanza o supera el 80 % del cupo (configurable) | Vendedor y responsable de cartera |
| `credit.limit.exceeded` | La exposición supera el 100 % o se retiene un documento | Responsable de cartera |
| `receivable.overdue` | Una factura entra en mora o cambia de rango de edad (trabajo diario) | Cobranza |
| `credit.hold.released` | Se libera un documento retenido | Auditoría |
| `credit.status.changed` | Cambia el estado de crédito del cliente | Integraciones (webhook) |

Todas se publican por el *outbox* y como webhooks estándar (ADR-0006, principio IX).

### R-CAR-014 · Estado de crédito del cliente
Derivado, recalculado en cada evento que cambie la exposición o la mora:

| Estado | Condición |
|---|---|
| `SUSPENDIDO` | Marcado manualmente (permiso `parties.credit.suspend`); prevalece sobre los demás |
| `BLOQUEADO_MORA` | Mora > `block_days_overdue` (R-CAR-012) |
| `BLOQUEADO_CUPO` | `exposición ≥ credit_limit` |
| `ALERTA` | Exposición ≥ 80 % del cupo, o alguna factura en mora ≤ `block_days_overdue` |
| `AL_DIA` | Ninguna de las anteriores |

Orden de prevalencia: `SUSPENDIDO` > `BLOQUEADO_MORA` > `BLOQUEADO_CUPO` > `ALERTA` > `AL_DIA`.

### R-CAR-015 · Cambios del cupo y del plazo
Modificar `credit_limit` o `payment_term_days` exige el permiso `parties.credit.manage`, deja el valor anterior
y el nuevo en la bitácora y NO afecta documentos ya emitidos. Reducir el cupo por debajo de la exposición actual
es válido: bloquea nuevos documentos hasta que la exposición baje.

## 4. Reglas de cuentas por pagar (CxP)

### R-CAR-020 · Registro y causación
La factura de proveedor (o documento soporte) causa el gasto/inventario, el IVA descontable, las retenciones
practicadas y la cuenta por pagar (P-05, P-06). El vencimiento se calcula por el plazo pactado.

### R-CAR-021 · Pago a proveedores
El **comprobante de egreso** aplica a una o más cuentas por pagar y genera el asiento `Dr Proveedores / Cr
Bancos` (P-07). El calendario de pagos se ordena por vencimiento, con descuentos por pronto pago si aplican.

### R-CAR-022 · Certificados de retención practicada
El sistema produce el certificado anual por tercero y concepto con base en las líneas de las cuentas de
retención por pagar (R-IMP-013).

### R-CAR-023 · Las cuentas por pagar no se saldan sin soporte
Un egreso exige referencia al documento causado. Los pagos anticipados a proveedores se registran como
**anticipos** (1330 🔶) y se cruzan con la factura cuando llega. Las devoluciones a proveedores reducen la
cuenta por pagar según R-INV-045.

## 5. Pruebas obligatorias del módulo

| Prueba | Criterio |
|---|---|
| Edades de cartera | El reporte de ejemplo de R-CAR-006 coincide al centavo y suma el saldo del mayor |
| Cupo | El ejemplo de R-CAR-008 da exposición 8.000.000 y excedente 500.000 |
| Bloqueo | Pedido que excede el cupo ⇒ `CREDIT_HOLD`; liberación con permiso y motivo ⇒ continúa, con bitácora |
| Mora | Cliente con una factura en mora de 31 días ⇒ `BLOQUEADO_MORA`; aun así puede comprar de contado |
| Liberación de cupo | Un abono, una nota crédito o la cancelación de un pedido suben el cupo disponible en el acto |
| Atomicidad | Emitir una factura a crédito: si el asiento falla, no se consume cupo ni número (principio III) |
| Concurrencia | Dos pedidos simultáneos que juntos superan el cupo ⇒ exactamente uno se confirma; el otro se retiene |
| Conciliación | Σ cartera por cliente = saldo de cuentas de clientes en el mayor (R-CAR-001) |
