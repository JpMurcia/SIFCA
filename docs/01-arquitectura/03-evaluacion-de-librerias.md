# Evaluación comparativa de librerías

Estado: **borrador de Fase 1 — propuesta sujeta a *spikes***

> **Cómo leer este documento.** La evaluación se basa en el conocimiento general que se tiene de cada
> librería; no se ejecutaron *benchmarks* ni se comprobó la última versión de cada una. Por eso cada sección
> termina con una **recomendación provisional** y un **spike** (prueba de concepto corta, con criterios de
> aceptación) que debe ejecutarse al inicio de la Fase 2 antes de fijar la decisión en el ADR.
> Escala usada: ● fuerte · ◐ aceptable · ○ débil.

## 1. ORM / acceso a datos: TypeORM vs Prisma vs Drizzle

### 1.1 Qué exige un sistema contable al acceso a datos

| # | Necesidad | Por qué importa |
|---|---|---|
| N-1 | Transacciones explícitas con nivel de aislamiento y alcance controlado (una por caso de uso) | Factura + stock + asiento + consecutivo deben ser atómicos |
| N-2 | Bloqueo de filas (`SELECT … FOR UPDATE`) | Consecutivos, saldo de stock y costo promedio bajo concurrencia |
| N-3 | `NUMERIC` sin pérdida (cadena o decimal, nunca `float`) | Evitar errores de redondeo (RK-02) |
| N-4 | Poder ejecutar SQL propio dentro de la misma transacción | *Triggers*, RLS, reportes con CTE y funciones de ventana |
| N-5 | Fijar variables de sesión por transacción (`SET LOCAL app.company_id`) | RLS multiempresa (ADR-0002) |
| N-6 | Migraciones como SQL revisable, con *triggers*, índices parciales, GIN y esquemas por módulo | Invariantes en la base de datos |
| N-7 | Buen encaje con NestJS y con repositorios detrás de puertos | Arquitectura hexagonal |
| N-8 | Tipado fuerte de resultados | Menos errores en código de reportes |
| N-9 | Madurez, mantenimiento y comunidad | Riesgo a 5+ años |

### 1.2 Comparativa

| Criterio | TypeORM | Prisma | Drizzle ORM |
|---|---|---|---|
| N-1 Transacciones / aislamiento | ● `QueryRunner` y `DataSource.transaction` con nivel de aislamiento | ● transacciones interactivas con opción de aislamiento | ● `db.transaction` con configuración de aislamiento |
| N-2 `FOR UPDATE` | ● bloqueos pesimistas (`pessimistic_write`…) en `find` y `QueryBuilder` | ○ no está en la API del cliente; requiere `$queryRaw` | ● `.for('update')` en las consultas |
| N-3 `NUMERIC` | ● el driver `pg` devuelve cadena (hay que envolverla en `Decimal`) | ● mapea a `Decimal` (decimal.js) | ● devuelve cadena por defecto |
| N-4 SQL propio en la misma transacción | ● `queryRunner.query` / `manager.query` | ◐ `tx.$queryRaw` (en la misma transacción interactiva) | ● la plantilla `sql` se mezcla con el constructor de consultas |
| N-5 Variables de sesión / RLS | ● se ejecuta `SET LOCAL` con el `QueryRunner` de la transacción | ◐ requiere extensión de cliente y transacción interactiva | ● mismo patrón; además modela políticas RLS en el esquema |
| N-6 Migraciones | ◐ autogeneradas por diferencia; hay que escribir a mano lo avanzado | ● Prisma Migrate genera SQL editable; *triggers*/parciales a mano | ● `drizzle-kit` genera SQL editable; *triggers* a mano |
| N-6b Múltiples esquemas (uno por módulo) | ● | ◐ soporte multiesquema más reciente | ● |
| N-7 Encaje con NestJS | ● módulo oficial `@nestjs/typeorm` | ◐ servicio propio (patrón habitual y sencillo) | ◐ integración comunitaria; sencillo de envolver |
| N-8 Tipado | ◐ entidades tipadas; `QueryBuilder` y relaciones con tipado débil | ● el mejor tipado de resultados | ● inferencia fuerte desde el esquema en TS |
| N-9 Madurez / mantenimiento | ◐ muy extendida; ritmo de mantenimiento irregular y muchos *issues* abiertos | ● mantenimiento activo y empresa detrás | ◐ más joven, evolución rápida |
| Curva de aprendizaje | ● baja (el equipo ya la conoce) | ● baja | ◐ media (hay que pensar en SQL) |

### 1.3 Análisis

- **Prisma** brilla en experiencia de desarrollo, pero pelea con tres necesidades que aquí son centrales:
  `FOR UPDATE` (N-2), triggers/índices parciales (N-6) y el patrón `SET LOCAL` por transacción (N-5). Cada una
  se resuelve con SQL crudo, es decir, se pierde justo la ventaja que aporta. No es inviable, pero el
  núcleo contable terminaría escrito casi todo en `$queryRaw`.
- **TypeORM** cubre N-1…N-5 sin rodeos y es lo que ya se planteó en el stack. Su debilidad es el tipado de
  consultas complejas y el mantenimiento: se mitiga limitando su uso (ver abajo).
- **Drizzle** es la opción técnicamente más cómoda para SQL explícito y tipado, pero es la menos integrada
  con NestJS y la más joven.

### 1.4 Recomendación provisional

**TypeORM** como ORM de la Fase 2, con estas reglas que reducen su riesgo y facilitan cambiarlo:

1. **El ORM vive solo en `infrastructure/persistence`.** Las entidades del ORM no salen de ahí; el dominio usa
   sus propias clases (regla D-2). Cambiar de ORM = reescribir un directorio por módulo.
2. **Operaciones críticas con SQL explícito:** asignación de consecutivos, descuento de stock y recálculo
   de costo promedio, contabilización. Se escriben como consultas parametrizadas revisadas.
3. **`synchronize` prohibido.** Migraciones escritas/revisadas a mano en SQL (ADR-0004).
4. **Reportes y libros** (balance de prueba, mayor, kardex, edades de cartera): SQL con CTE y ventanas, sin
   pasar por entidades. Si se necesita tipado, usar un constructor de consultas (p. ej. Kysely) solo en
   `reporting`.
5. **`Decimal` en el borde:** toda columna `numeric` se convierte a `Money`/`Decimal` en el *mapper*; el
   dominio nunca ve cadenas ni `number`.

**Spike S-ORM (1 día)** — criterios de aceptación:

- Emitir una factura de ejemplo en una sola transacción con 2 hilos concurrentes sobre el mismo ítem y el
  mismo rango: 0 consecutivos duplicados y 0 stock negativo en 1.000 repeticiones.
- `SET LOCAL app.company_id` activo y RLS impide leer filas de otra empresa desde el mismo pool.
- *Constraint trigger* de asiento cuadrado: una inserción descuadrada falla al `COMMIT`.
- Migración con esquema por módulo, índice parcial y *trigger*, aplicada y revertida.
- Si TypeORM falla alguno, repetir el spike con Drizzle antes de decidir.

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

## 4. Otras decisiones de librerías

| Necesidad | Recomendación provisional | Alternativas | Notas |
|---|---|---|---|
| Validación de entrada (HTTP) | `class-validator` + `class-transformer` (decorado en DTO) | zod + `nestjs-zod` | `class-validator` se integra directo con `@nestjs/swagger`; zod para variables de entorno y validación del lado del cliente |
| Documentación OpenAPI | `@nestjs/swagger` con el *plugin* de CLI | — | Ver `04-contrato-api-y-swagger.md` |
| Cola de tareas | **pg-boss** (sobre PostgreSQL) | BullMQ (Redis) | Una pieza menos de infraestructura; revisar si el volumen exige Redis |
| Cliente HTTP generado | `openapi-typescript` + `openapi-fetch`, u `orval` | — | Un solo cliente tipado para admin, vitrina y móvil |
| Datos del lado del cliente | TanStack Query | RTK Query | Caché, reintentos, invalidación |
| Formularios en el back-office | Los de AntD `Form` | React Hook Form | — |
| XML (UBL) | `xmlbuilder2` o `fast-xml-parser` (según se construya o se lea) | — | Si se emite vía proveedor tecnológico, se reduce a lo que pida su API |
| Firma XAdES | **No implementar al inicio** (lo hace el proveedor tecnológico) | `xml-crypto`/`xadesjs` si se habilita facturador propio | La firma XAdES con la política de la DIAN es delicada (ADR-0003) |
| Fechas | `date-fns` + `date-fns-tz` (o Luxon) | API Temporal cuando esté disponible | Fecha contable como `date` sin zona |
| Logs | `pino` | — | Con redacción de campos sensibles |
| Pruebas unitarias | Vitest o Jest | — | Elegir uno por monorepo |
| Pruebas con base de datos real | Testcontainers (PostgreSQL) | — | Necesarias para RLS, *triggers* y concurrencia |
| Pruebas de propiedades | `fast-check` | — | Invariantes contables (p. ej. «cualquier secuencia de asientos válidos deja el balance cuadrado») |
| Pruebas de contrato OpenAPI | Comparador de cambios incompatibles en CI (p. ej. `oasdiff`) | — | Falla el CI si se rompe la API pública |
| Móvil | Expo + el cliente generado | — | Mismo contrato que la web |

## 5. Gestión del monorepo

| Opción | Evaluación |
|---|---|
| **pnpm workspaces + Turborepo** | ● ligera, caché de tareas, curva baja. Recomendada |
| Nx | ● potente (grafo de proyectos, generadores, límites de módulos); más pesada |
| npm/yarn workspaces sin orquestador | ◐ suficiente al inicio, sin caché de tareas |

Recomendación provisional: **pnpm + Turborepo**. Si la verificación de límites entre módulos (D-3, D-5) se
quiere automatizar con la herramienta del monorepo, Nx lo trae resuelto; con Turborepo se usa
`dependency-cruiser`/`eslint-plugin-boundaries`.

## 6. Resumen de decisiones provisionales

| Tema | Elección provisional | Se confirma con |
|---|---|---|
| ORM | TypeORM (restringido a `infrastructure`) | Spike S-ORM |
| Decimal | `decimal.js` detrás de `Money` | — |
| UI back-office | Ant Design 5 + grilla editable (AG Grid Community o TanStack Table) | Spike S-UI |
| Paleta de comandos | `cmdk` | Spike S-UI |
| UI vitrina | Next.js + Tailwind + shadcn/ui | — |
| Cola | pg-boss | Volumen real |
| Monorepo | pnpm + Turborepo | — |
