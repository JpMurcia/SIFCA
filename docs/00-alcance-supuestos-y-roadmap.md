# Alcance, supuestos y roadmap

## 1. Definición del sistema

SIFCA tiene dos capas:

1. **Front-office (público):** sitios web genéricos y dinámicos por empresa, con catálogo de productos
   interactivo, generación de pedidos y vitrina comercial.
2. **Back-office (privado):** ERP contable y administrativo.

### 1.1 Módulos del back-office dentro del alcance

| Módulo | Alcance funcional |
|---|---|
| Inventario | Multibodega, lotes (con vencimiento), kardex, valorización por **promedio ponderado**, control de stock, traslados, ajustes |
| Facturación y ventas | Cotización → pedido → factura electrónica (validación previa DIAN, UBL 2.1), notas crédito/débito, POS |
| Cartera, CxC y CxP | Plazos, recibos de caja, comprobantes de egreso, edades de cartera, gestión de cobranza |
| Préstamos y financiamiento | Amortización, cálculo de intereses, cronogramas, mora (otorgados y recibidos; ver Q-11) |
| Contabilidad general | PUC, libro diario, libro mayor, balance de prueba, estados financieros NIIF Pymes, causación automática de ReteFuente, ReteIVA y ReteICA |

### 1.2 Características transversales

| Característica | Resumen | Documento |
|---|---|---|
| Paleta de comandos (Cmd/Ctrl+K) | Navegación y acciones por teclado en todo el back-office | `01-arquitectura/01-…` §8 |
| Motor de reportes y plantillas (Asia-POP) | PDF de facturas, cotizaciones, recibos y catálogos | `01-arquitectura/05-…` |
| API First + Webhooks | API Keys con alcances, webhooks firmados, OpenAPI | `01-arquitectura/04-…` |

## 2. Fuera de alcance (por ahora)

Se documentan para que el diseño **no los bloquee**, pero no se especifican en esta fase:

- Nómina electrónica y seguridad social.
- Activos fijos y depreciación.
- Información exógena (medios magnéticos) y declaraciones (IVA, retención, renta, ICA). El diseño conserva
  los datos necesarios (tercero y concepto en cada línea contable) para habilitarlo después.
- Conciliación bancaria automática y extractos.
- Multimoneda y diferencia en cambio (el MVP opera solo en COP).
- Producción / manufactura (clase 7 del PUC).
- Régimen Simple de Tributación (RST) con anticipos bimestrales.
- Pasarela de pagos en línea para la vitrina.
- Recepción de facturas de proveedores por correo y eventos RADIAN.

## 3. Supuestos

| ID | Supuesto | Impacto si es falso |
|---|---|---|
| S-01 | **Multiempresa (SaaS):** un solo despliegue atiende varias empresas, aisladas por `company_id` y Row-Level Security | Cambia el modelo de datos y el despliegue (ADR-0002) |
| S-02 | La emisión ante la DIAN se hace a través de un **proveedor tecnológico autorizado** (adaptador intercambiable), no con habilitación propia como facturador | Habilitación propia implica certificado de firma, set de pruebas y operación propia (ADR-0003) |
| S-03 | Marco contable: **Grupo 2 (NIIF para Pymes)** según la definición del proyecto. Pueden aparecer clientes del Grupo 3 (microempresas) | Ver Q-05 |
| S-04 | Moneda funcional y de presentación: COP, a 2 decimales | — |
| S-05 | Todas las empresas cliente son responsables del régimen ordinario (no RST) en el MVP | Ver Q-04 |
| S-06 | Zona horaria de negocio: `America/Bogota` (UTC−5, sin horario de verano). Persistencia en UTC (`timestamptz`) | — |
| S-07 | Asia-POP corre como **servicio interno**, no expuesto a internet, y SIFCA es su único cliente | Ver Q-03 y `05-integracion-asia-pop.md` |
| S-08 | Un contador público asesora el proyecto y valida el catálogo de reglas | Sin validación no se publica a producción |

## 4. Preguntas abiertas

Cada pregunta indica quién puede responderla y qué decisión desbloquea.

| ID | Pregunta | Responde | Bloquea |
|---|---|---|---|
| Q-01 | ¿SaaS multiempresa (S-01) o una instalación por cliente? | Producto | ADR-0002, modelo de datos |
| Q-02 | ¿Se usará un proveedor tecnológico DIAN? ¿Cuál (costo por documento, API, soporte)? | Producto + contador | ADR-0003, Fase 3 |
| Q-03 | ¿Asia-POP se despliega compartido o una instancia por empresa? Hoy guarda datos en SQLite local y sirve a una sola tienda | Producto + dueño de Asia-POP | AP-CR-05, plan de despliegue |
| Q-04 | ¿Habrá clientes en Régimen Simple de Tributación? | Contador | Motor de impuestos (retenciones/ICA/IVA se comportan distinto) |
| Q-05 | ¿Los clientes objetivo son Grupo 2 o también Grupo 3 (contabilidad simplificada)? | Contador | Plantillas de estados financieros |
| Q-06 | ¿El POS debe operar **sin internet**? | Producto | Diseño offline-first del POS y contingencia |
| Q-07 | ¿La vitrina necesita pagos en línea? | Producto | Alcance de Fase 6 |
| Q-08 | ¿Dónde se aloja (nube, región, proveedor de PostgreSQL gestionado)? | Producto + infraestructura | Backups, RPO/RTO, costos |
| Q-09 | ¿Quién es el contador de referencia que valida reglas? | Producto | Calendario de validación |
| Q-10 | ¿Se necesita recepción/aceptación de facturas de proveedores (RADIAN) en el MVP? | Producto + contador | Módulo `einvoicing` |
| Q-11 | En «Préstamos»: ¿el negocio **presta dinero** a terceros/empleados (otorgados), **recibe** créditos de bancos (recibidos), o ambos? Prestar dinero de forma habitual como actividad puede tener implicaciones regulatorias (usura, supervisión) | Producto + contador/abogado | Alcance del módulo `lending` |
| Q-12 | ¿Las empresas llevan contabilidad por **centros de costo** o **sucursales**? | Contador | Dimensiones analíticas en el asiento |

## 5. Riesgos principales

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| RK-01 | Reglas tributarias que cambian (ejemplo real: el Decreto 572 de 2025 modificó bases de retención y fue **suspendido** parcialmente en mayo de 2026, ver `02-…/02-impuestos…`) | Alta | Alto | Parámetros como datos con vigencia, pruebas por fecha, proceso de actualización normativa |
| RK-02 | Errores de redondeo que descuadran contra la validación DIAN | Media | Alto | `NUMERIC` + librería decimal, política única de redondeo (R-CON-009), pruebas con vectores del Anexo Técnico |
| RK-03 | Dependencia del proveedor tecnológico DIAN | Media | Alto | Puerto/adaptador, estados propios, cola con reintentos, no acoplar el dominio al proveedor |
| RK-04 | Concurrencia: dos ventas simultáneas sobre el mismo stock o el mismo consecutivo | Alta | Alto | Transacción única con bloqueo de fila, consecutivos con `SELECT … FOR UPDATE`, pruebas de concurrencia |
| RK-05 | Asia-POP hoy es una app local de catálogo, no un servicio de renderizado de documentos | Alta | Medio | Cambios acotados y versionados (AP-CR-01…10); alternativa: renderizar PDFs de documentos dentro de SIFCA |
| RK-06 | Validar reglas contables sin contador | Media | Alto | S-08, estados ✅/⚠️/🔶 y regla de no pasar a código sin ✅ |
| RK-07 | Alcance excesivo (competir en amplitud con ERPs consolidados) | Alta | Alto | Roadmap por fases, MVP con contabilidad + ventas + factura electrónica |

## 6. Roadmap por fases

| Fase | Entregable | Criterio de salida |
|---|---|---|
| **F1 — Especificaciones** (actual) | Esta carpeta `docs/` | Contador revisó el catálogo de reglas; preguntas Q-01…Q-05 respondidas |
| **F2 — Núcleo** | Monorepo, IAM y API keys, empresas, terceros, catálogo de ítems, **contabilidad general** (PUC, comprobantes, períodos, libros, balance de prueba) | Pruebas de invariantes contables en verde; OpenAPI generado y publicado |
| **F3 — Ventas e inventario** | Inventario multibodega con kardex y promedio ponderado; cotización → pedido → factura; **factura electrónica** vía proveedor tecnológico; notas crédito/débito; PDF con Asia-POP | Facturas aceptadas por la DIAN en habilitación (pruebas) |
| **F4 — Cartera y compras** | CxC/CxP, recibos de caja y egresos, retenciones, edades de cartera, compras y documento soporte, **POS** | Cartera cuadra con el mayor del PUC |
| **F5 — Préstamos** | Amortización, mora, contabilización | Cronogramas coinciden con casos de prueba del catálogo |
| **F6 — Vitrina pública** | Sitios por empresa, catálogo, pedidos, PDF de catálogo con Asia-POP | Pedido web → factura de extremo a extremo |
| **F7 — Móvil y webhooks** | App Expo, webhooks, paleta de comandos completa | — |

La paleta de comandos y la API con API Keys se construyen **desde F2** (no al final), porque condicionan el
diseño de permisos y de rutas.
