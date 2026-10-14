# Alcance, decisiones y roadmap

Gobernanza: este documento está subordinado a [`constitution.md`](constitution.md). Las especificaciones
detalladas viven en [`specs/`](specs/README.md).

## 1. Definición del sistema

SIFCA tiene dos capas:

1. **Front-office (público):** sitios web genéricos y dinámicos por empresa, con catálogo de productos
   interactivo, generación de pedidos y vitrina comercial.
2. **Back-office (privado):** ERP contable y administrativo.

### 1.1 Módulos del back-office dentro del alcance

| Módulo | Alcance funcional |
|---|---|
| Inventario y logística | Multibodega, lotes con vencimiento, kardex, **costeo PEPS y promedio ponderado por ítem**, política de despacho (FEFO/FIFO/LIFO físico), **clasificación ABC**, **punto de reorden y stock de seguridad**, conteos cíclicos, traslados, ajustes y **devoluciones (RMA)** |
| Facturación y ventas | Cotización → pedido → factura electrónica (emisión mediante **Proveedor Tecnológico Autorizado**, UBL 2.1), notas crédito/débito, POS |
| **Ventas a crédito y cartera** | **Límite de crédito por cliente**, plazos, **edades de cartera** (corriente, 30, 60, 90+), recibos de caja y abonos, **control de mora y bloqueo de despacho por cupo excedido**, cuentas por pagar |
| Compras | Orden de compra, factura de proveedor, documento soporte, devoluciones a proveedor |
| Contabilidad general | PUC, libro diario, mayor, balance de prueba, estados financieros NIIF Pymes, causación automática de ReteFuente, ReteIVA y ReteICA, **inmutabilidad y reversiones** |

### 1.2 Características transversales

| Característica | Resumen | Documento |
|---|---|---|
| Paleta de comandos (Cmd/Ctrl+K) | Navegación y acciones por teclado en todo el back-office | `01-arquitectura/01-…` §8 |
| API First + Webhooks | Contratos OpenAPI derivados de Zod, API Keys con alcances, webhooks firmados | `01-arquitectura/04-…` |
| Documentos PDF | Puerto `DocumentRenderer` con renderizador mínimo propio; motores externos consumen la API y los webhooks | `01-arquitectura/05-…` |

## 2. Decisiones vigentes (antes preguntas bloqueantes)

| ID | Tema | Decisión | Documentos afectados |
|---|---|---|---|
| **Q-01** | Despliegue | **SaaS multiempresa**, aislamiento por `tenant_id` en PostgreSQL: esquema compartido con discriminador y **RLS** | Constitución IV, ADR-0002, modelo de datos |
| **Q-02** | Emisión DIAN | Mediante **Proveedor Tecnológico Autorizado (PTA)** en la primera fase, **desacoplado por una interfaz de servicio** (`EInvoiceProvider`) para permitir facturación directa en el futuro | Constitución IX, ADR-0003, `02-…/03-…` |
| **Q-03** | Asia-POP | **Fase futura / experimental.** No se acopla al núcleo. SIFCA expone contratos OpenAPI limpios y webhooks estándar para que cualquier motor externo los consuma cuando esté listo | Constitución IX, ADR-0008, `01-…/05-…` |
| **Q-11** | Préstamos | **Fuera de alcance.** SIFCA no es entidad crediticia ni gestiona préstamos. En su lugar: **ventas a crédito y cartera** (cupo por cliente, plazos, edades, recibos y abonos, mora y bloqueo por cupo) | Constitución (alcance), `02-…/05-…`, modelo de datos |
| — | Stack | NestJS en capas Domain → Application → Infrastructure → Presentation; PostgreSQL; **Prisma ORM** (reemplaza a TypeORM); **Zod** como única fuente de contratos | Constitución II y V, ADR-0001, 0004, 0009 |
| — | Inventario | Costeo por ítem: **PEPS** (obligatorio en perecederos) o **promedio ponderado** (por defecto); **UEPS solo como política de despacho físico**; ABC, ROP y RMA especificados | `02-…/04-…`, ADR-0010 |

## 3. Fuera de alcance (por ahora)

Se documentan para que el diseño **no los bloquee**, pero no se especifican en esta fase:

- **Préstamos, financiación y cualquier actividad crediticia** (decisión Q-11).
- **Intereses de mora automáticos** (si la empresa los cobra, usa una nota débito manual).
- Motores externos de documentos, catálogos y reportes (Asia-POP): fase futura / experimental.
- Nómina electrónica y seguridad social.
- Activos fijos y depreciación.
- Información exógena (medios magnéticos) y declaraciones (IVA, retención, renta, ICA). El diseño conserva los
  datos necesarios (tercero y concepto en cada línea contable) para habilitarlo después.
- Conciliación bancaria automática y extractos.
- Multimoneda y diferencia en cambio (el MVP opera solo en COP).
- Producción / manufactura (clase 7 del PUC).
- Régimen Simple de Tributación (RST) con anticipos bimestrales.
- Pasarela de pagos en línea para la vitrina.
- Recepción de facturas de proveedores por correo y eventos RADIAN.
- Cambio de método de costeo con movimientos existentes y deterioro periódico del inventario.

## 4. Supuestos

| ID | Supuesto | Impacto si es falso |
|---|---|---|
| S-01 | En el MVP **un tenant es una empresa (un NIT)**. Si un tenant necesitara varias razones sociales, se añade `legal_entity_id` como dimensión; el aislamiento y los permisos siguen por `tenant_id` | Modelo de datos y permisos |
| S-02 | El PTA seleccionado entrega XML firmado, respuesta de la DIAN y, idealmente, la representación gráfica (PDF); si no entrega PDF, SIFCA lo genera con su renderizador mínimo | Alcance del puerto `DocumentRenderer` |
| S-03 | Marco contable por defecto: **Grupo 2 (NIIF para Pymes)**. Pueden aparecer clientes del Grupo 3 (microempresas) | Ver Q-05 |
| S-04 | Moneda funcional y de presentación: COP, a 2 decimales | — |
| S-05 | Todas las empresas cliente son responsables del régimen ordinario (no RST) en el MVP | Ver Q-04 |
| S-06 | Zona horaria de negocio: `America/Bogota` (UTC−5, sin horario de verano). Persistencia en UTC (`timestamptz`) | — |
| S-07 | Un contador público asesora el proyecto y valida el catálogo de reglas | Sin validación no se publica a producción |
| S-08 | El «despacho» se modela como un estado del pedido/factura (`RELEASED`/`DISPATCHED`); no hay un módulo de transporte | Alcance de logística |

## 5. Preguntas abiertas

| ID | Pregunta | Responde | Bloquea |
|---|---|---|---|
| Q-04 | ¿Habrá clientes en Régimen Simple de Tributación? | Contador | Motor de impuestos (retenciones/ICA/IVA se comportan distinto) |
| Q-05 | ¿Los clientes objetivo son Grupo 2 o también Grupo 3 (contabilidad simplificada)? | Contador | Plantillas de estados financieros |
| Q-06 | ¿El POS debe operar **sin internet**? | Producto | Diseño offline-first del POS y contingencia (R-FE-011) |
| Q-07 | ¿La vitrina necesita pagos en línea? | Producto | Alcance de la fase de vitrina |
| Q-08 | ¿Dónde se aloja (nube, región, proveedor de PostgreSQL gestionado)? | Producto + infraestructura | Backups, RPO/RTO, costos |
| Q-09 | ¿Quién es el contador de referencia que valida reglas? | Producto | Calendario de validación (principio VII) |
| Q-10 | ¿Se necesita recepción/aceptación de facturas de proveedores (RADIAN) en el MVP? | Producto + contador | Módulo `einvoicing` |
| Q-12 | ¿Las empresas llevan contabilidad por **centros de costo** o **sucursales**? | Contador | Dimensiones analíticas en el asiento |
| Q-13 | ¿Qué proveedor tecnológico (PTA) se usará y entrega PDF? (criterios en `02-…/03-… §6`) | Producto + contador | Adaptador de la fase de factura electrónica |
| Q-14 | ¿Qué contador valida el **tratamiento de devoluciones** (retenciones sufridas, diferencia de costo en devolución a proveedor)? Puntos marcados 🔶 en R-INV-043 y R-INV-045 | Contador | Especificación 004 y 005 |

## 6. Riesgos principales

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| RK-01 | Reglas tributarias que cambian (ejemplo real: el Decreto 572 de 2025 fue **suspendido** parcialmente en mayo de 2026, ver `02-…/02-impuestos…`) | Alta | Alto | Parámetros como datos con vigencia, pruebas por fecha, proceso de actualización normativa |
| RK-02 | Errores de redondeo que descuadran contra la validación DIAN | Media | Alto | `NUMERIC` + decimal, política única (R-CON-009), vectores del Anexo Técnico |
| RK-03 | Dependencia del PTA | Media | Alto | Puerto/adaptador, estados propios, cola con reintentos, no acoplar el dominio |
| RK-04 | Concurrencia: dos ventas sobre el mismo stock, el mismo consecutivo o el mismo cupo de crédito | Alta | Alto | Transacción única, bloqueos de fila, pruebas de concurrencia |
| RK-05 | Limitaciones de Prisma para bloqueos y RLS (no ofrece `FOR UPDATE` en su API) | Media | Medio | SQL explícito en transacciones interactivas, spike S-PRISMA (ADR-0004) |
| RK-06 | Validar reglas contables sin contador | Media | Alto | S-07, estados ✅/⚠️/🔶 y principio VII |
| RK-07 | Alcance excesivo (competir en amplitud con ERPs consolidados) | Alta | Alto | Roadmap por fases, MVP con contabilidad + ventas + factura electrónica |
| RK-08 | Cálculos de ABC y ROP con datos escasos o con quiebres de stock (demanda censurada) | Media | Medio | R-INV-030 (excluir días sin disponible, mínimo de historial, marca `LOW_CONFIDENCE`) |
| RK-09 | Confundir costeo con despacho físico (UEPS) y contabilizar mal | Media | Alto | R-INV-001/017: UEPS solo como despacho; validación de esquema y advertencia |

## 7. Roadmap por fases

| Fase | Entregable | Criterio de salida |
|---|---|---|
| **F1 — Especificaciones** (actual) | `docs/`: constitución, specs, reglas, arquitectura | Contador revisó el catálogo; specs 001–010 aprobadas |
| **F2 — Núcleo** | Monorepo, tenancy (RLS), IAM y API Keys, terceros, catálogo, **contabilidad general** (PUC, comprobantes inmutables, períodos, libros) | Invariantes contables en verde (propiedades), prueba de aislamiento entre tenants, OpenAPI derivado de Zod |
| **F3 — Inventario y ventas** | Kardex con costeo PEPS/promedio, política de despacho, cotización → pedido → factura, **factura electrónica vía PTA**, notas | Facturas aceptadas por la DIAN en habilitación; transacción atómica probada |
| **F4 — Cartera, compras y devoluciones** | Ventas a crédito (cupo, plazos, edades, recibos, bloqueos), compras, **devoluciones con nota crédito y reingreso a kardex**, devolución a proveedor | Cartera cuadra con el mayor; escenarios de RMA en verde |
| **F5 — Logística avanzada** | **ABC**, **ROP/stock de seguridad**, conteos cíclicos, alertas y reportes | Ejemplos numéricos de R-INV-020…023 y R-INV-030…034 reproducidos |
| **F6 — Vitrina pública** | Sitios por empresa, catálogo, pedidos web con reserva | Pedido web → factura de extremo a extremo |
| **F7 — Móvil y webhooks** | App Expo, webhooks completos, paleta de comandos completa | — |
| **F8 — Integraciones y migración** | Configuración por empresa, conectores (Alegra de solo lectura y archivos CSV/XLSX), asistente de migración con mapeos, ensayo y conciliación, sincronización opcional. Diseño: [`04-diseno-ux/06-…`](04-diseno-ux/06-integraciones-migracion-y-configuracion.md) | Migrar una empresa de prueba con conciliación en cero por cuenta, tercero e ítem y deshacer la corrida sin perder la inmutabilidad |
| **Futura / experimental** | Integración con motores externos de documentos y catálogos (Asia-POP) consumiendo los contratos de SIFCA | No bloquea ninguna fase anterior |

La paleta de comandos y la API con API Keys se construyen **desde F2**, porque condicionan el diseño de
permisos y de rutas.
