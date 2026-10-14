# Evaluación comparativa de librerías

Estado: **Fase 1 (actualizada)** — ORM y validación **decididos**; el resto, propuesta sujeta a *spikes*

> **Cómo leer este documento.** El **ORM (Prisma)** y la **validación (Zod)** son decisiones definitivas del
> arquitecto principal; lo que se verifica con *spikes* son sus mitigaciones. El resto es **recomendación
> provisional**: la evaluación se basa en el conocimiento general de cada librería (sin *benchmarks* ni
> comprobar la última versión) y termina con un **spike** (prueba de concepto corta, con criterios de
> aceptación) que se ejecuta al inicio de la Fase 2 antes de fijar la decisión en el ADR.
> Escala usada: ● fuerte · ◐ aceptable · ○ débil.

## 1. ORM / acceso a datos: decisión definitiva — Prisma ORM

**Decisión (vigente):** **Prisma ORM** sobre PostgreSQL, **sustituye definitivamente a TypeORM** (ADR-0004).
Se aprovechan su tipado estricto generado en tiempo de compilación y las transacciones interactivas
`$transaction`. Esta sección ya no es una comparación abierta: documenta **qué exige el sistema, cómo lo
cumple Prisma, dónde hay que ayudarle y cómo se verifica**.

### 1.1 Qué exige un sistema contable al acceso a datos

| # | Necesidad | Por qué importa |
|---|---|---|
| N-1 | Transacciones explícitas con nivel de aislamiento y alcance controlado (una por caso de uso) | Factura + stock + cartera + asiento + consecutivo deben ser atómicos (constitución III) |
| N-2 | Bloqueo de filas (`SELECT … FOR UPDATE`) | Consecutivos, saldo de stock, capas PEPS, costo promedio y cupo de crédito bajo concurrencia |
| N-3 | `NUMERIC` sin pérdida (decimal, nunca `float`) | Evitar errores de redondeo (RK-02) |
| N-4 | Poder ejecutar SQL propio dentro de la misma transacción | *Triggers*, RLS, reportes con CTE y funciones de ventana |
| N-5 | Fijar variables de sesión por transacción (`app.tenant_id`) | RLS multiempresa (constitución IV) |
| N-6 | Migraciones como SQL revisable, con *triggers*, `REVOKE`, índices parciales, GIN y esquemas por módulo | Invariantes en la base de datos (constitución I) |
| N-7 | Encaje con NestJS y con repositorios detrás de puertos | Clean Architecture (constitución II) |
| N-8 | Tipado fuerte de resultados | Menos errores en código de reportes |
| N-9 | Madurez, mantenimiento y comunidad | Riesgo a 5+ años |

### 1.2 Cómo cumple Prisma cada necesidad

| # | Cobertura | Cómo | Verificación |
|---|---|---|---|
| N-1 | ● Nativa | `prisma.$transaction(async (tx) => …, { maxWait, timeout, isolationLevel })`; admite desde *ReadUncommitted* hasta *Serializable* | ✅ opciones y **plazo por defecto de ≈ 5 s** confirmados en documentación y guías de terceros: se configuran **explícitamente** |
| N-2 | ◐ **Con SQL explícito** | La API tipada de Prisma no expone `FOR UPDATE`; se usa `tx.$queryRaw` **dentro de la misma transacción** | 🔶 práctica estándar; se prueba en S-PRISMA |
| N-3 | ● Nativa | `Decimal` (basado en decimal.js); el *mapper* lo convierte a `Money`/`Quantity` del dominio | 🔶 |
| N-4 | ● Nativa | `tx.$queryRaw` / `tx.$executeRaw` parametrizados | 🔶 |
| N-5 | ◐ **Con SQL explícito** | `tx.$executeRaw` con `set_config('app.tenant_id', $1, true)` al inicio de cada transacción, encapsulado en el `UnitOfWork` | 🔶 se prueba en S-PRISMA (incluido el comportamiento con un *pooler*) |
| N-6 | ◐ **Con SQL a mano** | Prisma Migrate genera SQL editable (`--create-only`); *triggers*, RLS, `REVOKE` e índices parciales/GIN se escriben en la migración | 🔶; soporte multiesquema a verificar |
| N-7 | ● | El cliente de Prisma se envuelve en un servicio de `infrastructure`; los repositorios implementan puertos de `application` | — |
| N-8 | ● Fuerte | Tipos generados desde el esquema (que **no** salen de `infrastructure`, D-4) | — |
| N-9 | ● | Mantenimiento activo | 🔶 |

### 1.3 Riesgos asumidos y mitigaciones

La evaluación de la Fase 1 ya señalaba que Prisma es la opción que más se sale de su API tipada en un
sistema contable (N-2, N-5, N-6). Se acepta esa decisión con estas mitigaciones:

| Riesgo | Mitigación |
|---|---|
| El núcleo contable termina escrito en SQL crudo y se pierde el tipado | Se **limita** el SQL crudo a tres utilidades de `infrastructure` (`lockRows`, `setTenant`, `appendOnlyInsert`) y a reportes; todo lo demás usa la API tipada. Cada consulta cruda tiene prueba de integración sobre PostgreSQL real |
| Olvidar `FOR UPDATE` o el `set_config` en un repositorio nuevo | Los repositorios **no** abren transacciones: reciben la transacción del `UnitOfWork`, que ya fijó el tenant; una regla de lint prohíbe `prisma.$transaction` fuera del `UnitOfWork` (G-04) |
| Transacciones largas (plazo por defecto corto) | Transacciones **cortas**: ninguna llamada de red dentro de la transacción (constitución III); `timeout` y `maxWait` explícitos por caso de uso |
| Migraciones SQL manuales desincronizadas del `schema.prisma` | Revisión de migraciones obligatoria; CI aplica las migraciones sobre una base vacía y ejecuta `prisma migrate diff` para detectar deriva |
| Bloqueo por *pooler* de conexiones | Verificar en S-PRISMA que `set_config(..., true)` y las transacciones interactivas funcionan con el *pooler* elegido; si no, usar conexión directa para el worker |
| Prisma deja de convenir a futuro | La arquitectura limpia lo contiene: cambiar de ORM = reescribir `infrastructure/persistence` de cada módulo (constitución II) |

### 1.4 Reglas de uso

1. Prisma **solo** en `infrastructure/persistence`; sus tipos no cruzan hacia `application` ni `domain` (D-4, G-03).
2. Un único `UnitOfWork` abre `$transaction`; propaga `tx` a los repositorios con un contexto asíncrono.
3. Importes y cantidades se leen como `Decimal` y se convierten de inmediato a objetos de valor del dominio.
4. Las tablas de registro inmutable se escriben **solo con inserciones** (`create`, `createMany`); el rol de la
   aplicación no tiene privilegios de `UPDATE`/`DELETE` sobre ellas, así que el código que lo intente falla
   en la base de datos.
5. Los reportes y libros usan SQL explícito (`$queryRaw`) con tipos de resultado declarados y validados.

### 1.5 Spike S-PRISMA (1–2 días, **verifica mitigaciones**, no reabre la decisión)

| Criterio de aceptación |
|---|
| Emitir una factura de ejemplo en **una** transacción con 2 hilos concurrentes sobre el mismo ítem y el mismo rango: 0 consecutivos duplicados y 0 stock negativo en 1.000 repeticiones (bloqueos con `$queryRaw`) |
| `set_config('app.tenant_id', …, true)` dentro de `$transaction`: RLS impide leer filas de otro tenant desde el mismo cliente y el mismo *pool* |
| Un *constraint trigger* de asiento cuadrado falla al `COMMIT` ante una inserción descuadrada y la transacción de Prisma se revierte |
| `REVOKE UPDATE, DELETE` sobre `journal_line` hace fallar un `prisma.journalLine.update(...)` |
| Migración con esquema por módulo, índice parcial, RLS y *trigger*, aplicada y revertida; `prisma migrate diff` sin deriva |
| `Decimal` ↔ `Money`: ida y vuelta sin pérdida con 1.000 valores aleatorios de 2 y 6 decimales |
| Transacción con `timeout` explícito: una transacción que lo excede se revierte por completo |
| Si algún criterio **no** se puede cumplir, se escala al arquitecto principal con la alternativa propuesta (sin cambiar de ORM por iniciativa propia) |

#### Resultado parcial del spike (2026-10-14, spec 001 · T010)

Verificado contra PostgreSQL 16 real con Prisma **7.10.0** + `@prisma/adapter-pg` 7.10.0 (`apps/api/prisma/schema.prisma`):

| Criterio | Resultado |
|---|---|
| Varios esquemas (`schemas = ["acc","audit"]` + `@@schema`) | ✅ `prisma validate` y `prisma generate` correctos **sin** marca de función en vista previa. No hace falta el plan B (prefijo `acc_`) |
| `$transaction` con `maxWait`, `timeout` e `isolationLevel` explícitos | ✅ aceptados |
| `set_config('app.tenant_id', …, true)` y `SELECT … FOR UPDATE` con `$queryRaw` en la misma transacción | ✅ la variable es visible dentro de la transacción; fuera de ella `current_setting(…, true)` devuelve **cadena vacía** (no `NULL`), por eso las políticas RLS usan `NULLIF(…, '')` |
| Rollback ante excepción | ✅ la fila no persiste |
| `Decimal` | ✅ se lee como `Decimal` (decimal.js) sin pasar por `number`; las lecturas SQL crudas usan `::text` |

Los demás criterios (concurrencia, RLS, *constraint trigger*, `REVOKE`, deriva de migración, ida y vuelta de `Decimal`)
se cubren con las pruebas de integración de la spec 001 (T022–T028, T039–T046). Lo anterior **no** verifica
comportamiento con un *pooler* de conexiones (queda abierto para el despliegue).

### 1.6 Historial de la evaluación (Fase 1, para contexto)

Se compararon TypeORM, Prisma y Drizzle frente a N-1…N-9. TypeORM y Drizzle cubrían N-2, N-5 y N-6 sin salirse
de su API (bloqueos pesimistas y `.for('update')`), Prisma ofrecía el mejor tipado y la mejor experiencia de
desarrollo. El arquitecto principal fijó Prisma como decisión definitiva; las mitigaciones de §1.3 convierten
esa diferencia en trabajo conocido y verificable.

## 2. Aritmética decimal

| Opción | Evaluación |
|---|---|
| `number` | **Descartado**: binario de punto flotante, no representa 0,1 exactamente |
| `decimal.js` | ● modos de redondeo (incluye *half-up*), precisión configurable, ampliamente usada |
| `big.js` | ◐ más pequeña, pero con menos modos de redondeo y funciones |
| `dinero.js` (enteros en centavos) | ◐ buen modelo para dinero, pero los costos unitarios con 6 decimales y las cantidades fraccionarias encajan peor |

**Recomendación:** `decimal.js` detrás de un objeto de valor `Money` propio (`packages/domain-shared`) que
fije moneda COP, escala 2 y la política de redondeo de R-CON-009. Prohibir `number` en el dominio con una
regla de lint.

## 3. Interfaz del back-office

### 3.1 Qué exige un back-office contable a la UI

| # | Necesidad |
|---|---|
| U-1 | Tablas **densas** con miles de filas (virtualización), columnas fijas, totales al pie, ordenar/filtrar |
| U-2 | **Edición tipo hoja de cálculo** en las líneas de comprobantes y facturas (navegar con Tab/Enter/flechas, pegar varias filas) |
| U-3 | Formularios grandes con validación, `DatePicker` y numéricos en formato `es-CO` |
| U-4 | Accesibilidad por teclado en todo (CP-07) |
| U-5 | Tema configurable (marca por empresa) y modo denso |
| U-6 | Licencia y costo previsibles |
| U-7 | Rendimiento y tamaño de *bundle* aceptables |

### 3.2 Comparativa

| Criterio | Ant Design (AntD) 5 | shadcn/ui + TanStack Table | MUI + DataGrid (X) | AG Grid Community (solo grillas) |
|---|---|---|---|---|
| U-1 Tablas densas / virtualización | ◐ `Table` con virtualización y columnas fijas; se degrada con edición compleja | ● control total con TanStack Table + Virtual (hay que construirlo) | ● DataGrid (funciones avanzadas en niveles de pago) | ● virtualización de filas y columnas, muy rápida |
| U-2 Edición tipo hoja | ○ edición por celda hay que construirla | ◐ hay que construirla | ◐ edición por celda en DataGrid; portapapeles/rango en niveles de pago | ● edición por celda y navegación por teclado de serie; **rango y portapapeles son Enterprise** |
| U-3 Formularios, fechas, locale | ● `Form`, `DatePicker`, `InputNumber`, locale `es_ES` | ◐ con React Hook Form + zod; más piezas | ● | ✗ (no es su función) |
| U-4 Teclado / accesibilidad | ◐ aceptable | ● base Radix, buena accesibilidad | ● | ◐ buen soporte de teclado en la grilla |
| U-5 Tema / densidad | ● tokens de diseño y algoritmo compacto | ● CSS variables + Tailwind, total libertad | ◐ | ◐ temas propios |
| U-6 Licencia / costo | ● MIT | ● MIT (el código se copia al proyecto) | ◐ núcleo MIT; funciones avanzadas de pago | ◐ Community MIT; funciones avanzadas de pago |
| U-7 Tamaño / rendimiento | ◐ pesada, CSS-in-JS | ● ligera y a medida | ◐ | ◐ |
| Productividad inicial | ● muy alta (todo hecho) | ◐ media (hay que armar el sistema de diseño) | ● alta | ● alta en grillas |

### 3.3 Paleta de comandos (Cmd/Ctrl+K)

Opciones: **`cmdk`** (primitivo sin estilos, base del componente *Command* de shadcn), **`kbar`**, o construirla
sobre el `Modal` + `Input` de AntD. Recomendado: **`cmdk`** como motor (accesible, controlado por teclado,
filtrado personalizable) con estilos propios; funciona igual junto a AntD. Los requisitos están en
`01-vision-general-y-modulos.md` §8.

### 3.4 Recomendación provisional

| Capa | Elección | Motivo |
|---|---|---|
| Back-office (cascarón, formularios, menús, modales, filtros) | **Ant Design 5** | Cobertura casi completa de componentes empresariales y locale; cubre U-3, U-5, U-6 |
| Grillas editables densas (líneas de comprobante y factura, kardex, balance) | **AG Grid Community** *o* `TanStack Table` con edición propia | AntD `Table` no resuelve bien U-2; decidir tras el spike |
| Paleta de comandos | **`cmdk`** | Ver §3.3 |
| Vitrina pública (Next.js) | **Tailwind CSS + shadcn/ui** | Libertad de marca por empresa y bajo peso (U-7) |

El back-office y la vitrina **no comparten** biblioteca de componentes: tienen necesidades opuestas
(densidad vs. marca y rendimiento de carga).

> **Alternativa a considerar:** si la edición tipo hoja de cálculo resulta central, ir con
> shadcn/ui + TanStack Table en todo el back-office evita mezclar dos sistemas de diseño, a costa de
> construir más piezas. El spike debe medir esa diferencia de esfuerzo.

**Spike S-UI (2 días)** — pantalla de comprobante contable con:

- 300 líneas editables, navegación con Tab/Enter/flechas, pegar 20 filas desde una hoja de cálculo.
- Totales de débito/crédito en vivo con `Decimal` y formato `es-CO` (`1.234.567,89`).
- Selección de cuenta con búsqueda por código o nombre sin salir del teclado.
- Abrir la paleta de comandos con `Ctrl+K` estando con foco en una celda.
- Medir tiempos de render y memoria con 5.000 filas de solo lectura.

## 4. Validación y contratos: decisión definitiva — Zod

**Decisión (vigente):** **Zod** es la **única fuente de verdad** de los contratos de datos: validación en los
casos de uso, esquemas compartidos con el frontend y base del OpenAPI (constitución V, ADR-0009).

### 4.1 Cómo se usa

| Aspecto | Regla |
|---|---|
| Dónde viven | `packages/contracts`: esquemas de entradas, salidas, errores, eventos y webhooks; los tipos se **infieren** (`z.infer`) |
| Dónde se validan | Al inicio de `execute` de **cada caso de uso** (capa Application), de modo que HTTP, worker, webhooks y pruebas tengan la misma garantía; los controladores no reimplementan validación |
| Dominio | **No importa Zod.** Los invariantes del dominio los protegen sus objetos de valor (`Money`, `Quantity`, `Percentage`) y entidades; un esquema Zod válido no sustituye al invariante |
| Esquemas estrictos | `strict()` en objetos de entrada: los campos desconocidos se rechazan |
| «Nada negativo ni inconsistente» | Helpers compartidos: `nonNegativeMoney`, `positiveQuantity`, `percentage0to100`, `uuidV7`, `isoDate`, `nit`; refinamientos entre campos (`due_date ≥ issue_date`, `Σ aplicaciones ≤ valor del recibo`) |
| Dinero en la API | Cadena decimal validada con patrón y escala (`"1190000.00"`); la conversión a `Money` ocurre en Application, no en Zod |
| Eventos entre módulos | Uniones discriminadas por `type` en `contracts` (un evento = un esquema) |
| Integraciones externas | Las respuestas del PTA, los cuerpos de webhooks entrantes y la configuración (variables de entorno) se validan con Zod **en el adaptador que las recibe** |
| Errores | `ZodError` → `422 application/problem+json` con `code = VALIDATION_FAILED` y la lista de campos |
| Frontend | React Hook Form + `zodResolver` con los mismos esquemas (los componentes de AntD se envuelven con `Controller`); el cliente tipado reutiliza los tipos inferidos |

### 4.2 OpenAPI derivado de los esquemas

Zod 4 incluye conversión nativa a JSON Schema (`z.toJSONSchema`, con destino `draft-2020-12` u `openapi-3.0`)
✅ ([documentación de Zod](https://zod.dev/json-schema)). Limitación documentada: los **refinamientos,
transformaciones y mensajes personalizados no se reflejan** en el JSON Schema, así que las reglas
entre campos se describen además en la `description` de cada esquema (`.meta({ description, examples })`).

| Opción para generar el OpenAPI 3.1 de NestJS | Estado |
|---|---|
| `nestjs-zod` (DTO desde Zod + integración con `@nestjs/swagger`) | 🔶 no verificado |
| `zod-openapi` / `@asteasolutions/zod-to-openapi` (documento OpenAPI construido desde los esquemas) | 🔶 `zod-openapi` v5 usa el conversor nativo de Zod 4 según fuentes de terceros |
| Ensamblador propio sobre `z.toJSONSchema` | ✅ viable (capacidad nativa), más trabajo |

**Spike S-ZOD (1 día):** generar el OpenAPI de 5 endpoints (incluida una respuesta de error `Problem`, un
evento y un webhook) desde `packages/contracts`; criterios: documento válido OpenAPI 3.1, ejemplos presentes,
instantánea en CI y rechazo en tiempo de ejecución de un cuerpo con campo desconocido, importe negativo y
decimal de más.

#### Resultado parcial del spike S-ZOD (2026-10-14, spec 001 · T011)

Con Zod **4.6.7**, `z.toJSONSchema()` produce: `pattern` para el esquema `Money`, `minItems`/`maxItems` para
`z.array().min(2).max(500)`, `additionalProperties: false` para `.strict()`, y uniones discriminadas como `oneOf`
con `const`/`enum` (`target: 'openapi-3.0'` o `'draft-2020-12'`). `z.uuid()` acepta UUID v7. Quedan por verificar
(spec 001, T087): ejemplos, respuestas de error `Problem` y la comparación con el contrato.

## 5. Otras decisiones de librerías

| Necesidad | Recomendación provisional | Alternativas | Notas |
|---|---|---|---|
| Validación y contratos | **Zod** (decisión definitiva, §4) | — | `class-validator`/`class-transformer` **no se usan** |
| Documentación OpenAPI | Derivada de los esquemas Zod (§4.2); `@nestjs/swagger` solo como soporte de Swagger UI si el spike S-ZOD lo requiere | — | Ver `04-contrato-api-y-swagger.md` |
| Cola de tareas | **pg-boss** (sobre PostgreSQL) | BullMQ (Redis) | Una pieza menos de infraestructura; revisar si el volumen exige Redis |
| Cliente HTTP tipado | `packages/api-client` sobre `fetch`, con tipos inferidos de `packages/contracts` | `openapi-typescript` generado desde el OpenAPI | Un solo cliente para admin, vitrina y móvil |
| Datos del lado del cliente | TanStack Query | RTK Query | Caché, reintentos, invalidación |
| Formularios en el back-office | **React Hook Form + `zodResolver`** con los esquemas de `contracts` | AntD `Form` con validador adaptado | Los mismos esquemas que valida el backend |
| XML (UBL) | `xmlbuilder2` o `fast-xml-parser` (según se construya o se lea) | — | Si se emite vía proveedor tecnológico, se reduce a lo que pida su API |
| Firma XAdES | **No implementar al inicio** (lo hace el proveedor tecnológico) | `xml-crypto`/`xadesjs` si se habilita facturador propio | La firma XAdES con la política de la DIAN es delicada (ADR-0003) |
| Fechas | `date-fns` + `date-fns-tz` (o Luxon) | API Temporal cuando esté disponible | Fecha contable como `date` sin zona |
| Logs | `pino` | — | Con redacción de campos sensibles |
| Pruebas unitarias | Vitest o Jest | — | Elegir uno por monorepo |
| Pruebas con base de datos real | Testcontainers (PostgreSQL) | — | Necesarias para RLS, *triggers*, privilegios y concurrencia; **no** se simula la base de datos |
| Pruebas de aceptación ejecutables | `@cucumber/cucumber` (Gherkin en español) | `vitest-cucumber` | Los `.feature` de `docs/specs/` son ejecutables (ver `specs/README.md`) |
| Reglas de arquitectura | `dependency-cruiser` | `eslint-plugin-boundaries` | Gates G-01 a G-03 y reglas D-1…D-7 |
| Pruebas de propiedades | `fast-check` | — | Invariantes contables (p. ej. «cualquier secuencia de asientos válidos deja el balance cuadrado») |
| Pruebas de contrato OpenAPI | Comparador de cambios incompatibles en CI (p. ej. `oasdiff`) | — | Falla el CI si se rompe la API pública |
| Móvil | Expo + `packages/api-client` | — | Mismo contrato que la web |

## 6. Gestión del monorepo

| Opción | Evaluación |
|---|---|
| **pnpm workspaces + Turborepo** | ● ligera, caché de tareas, curva baja. Recomendada |
| Nx | ● potente (grafo de proyectos, generadores, límites de módulos); más pesada |
| npm/yarn workspaces sin orquestador | ◐ suficiente al inicio, sin caché de tareas |

Recomendación provisional: **pnpm + Turborepo**. Si la verificación de límites entre módulos (D-3, D-5) se
quiere automatizar con la herramienta del monorepo, Nx lo trae resuelto; con Turborepo se usa
`dependency-cruiser`/`eslint-plugin-boundaries`.

## 7. Resumen de decisiones

| Tema | Elección | Estado | Se confirma con |
|---|---|---|---|
| ORM | **Prisma ORM** (solo en `infrastructure`) | **Definitiva** | Spike S-PRISMA (verifica mitigaciones) |
| Validación y contratos | **Zod** (`packages/contracts`) | **Definitiva** | Spike S-ZOD |
| Arquitectura del backend | Clean Architecture en 4 capas | **Definitiva** | `dependency-cruiser` en CI |
| Decimal | `decimal.js` detrás de `Money` | Provisional | — |
| UI back-office | Ant Design 5 + grilla editable (AG Grid Community o TanStack Table) | Provisional | Spike S-UI |
| Paleta de comandos | `cmdk` | Provisional | Spike S-UI |
| UI vitrina | Next.js + Tailwind + shadcn/ui | Provisional | — |
| Formularios | React Hook Form + `zodResolver` | Provisional | Spike S-UI |
| Cola | pg-boss | Provisional | Volumen real |
| Monorepo | pnpm + Turborepo | Provisional | — |
