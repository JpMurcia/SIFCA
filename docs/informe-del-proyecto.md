# Informe del proyecto SIFCA — lo realizado y lo investigado

**Fecha de corte:** 14 de octubre de 2026 · **Rama:** `claude/exciting-hamilton-6j0zpv` · **Idioma:** español.
Este informe resume, en un solo lugar, qué se hizo, qué se investigó (y con qué grado de certeza), qué se decidió, qué
resultados hay y qué falta. Para el detalle, cada sección remite al documento fuente.

## 1. Resumen ejecutivo

**SIFCA** (Sistema Integral Fiscal y Contable Ágil) es una plataforma SaaS multiempresa para empresas colombianas: un
back-office contable y administrativo (ERP) más una vitrina pública. Se construye **desde cero** sobre normatividad
pública colombiana y buenas prácticas, con **desarrollo guiado por especificaciones** (Spec Kit) y asistencia de IA.

| Dimensión | Estado |
|---|---|
| Documentación y especificación (Fase 1) | ✅ Completa: constitución, 11 especificaciones con 157 escenarios ejecutables, 95 reglas normativas, 13 decisiones de arquitectura, 4 flujos de proceso |
| Plan y tareas de la primera especificación (001, contabilidad) | ✅ 94 tareas |
| **Implementación de la spec 001 (backend de contabilidad)** | ✅ **93 de 94 tareas**; la restante (T092) espera la validación humana del contador |
| Especificaciones 002–011 | 📐 Especificadas; sin plan de implementación ni código |
| Interfaz de usuario | 💡 No existe; se entrega la **especificación para maquetar** ([`04-diseno-ux/`](04-diseno-ux/README.md)) |
| Liberación a producción | ⛔ Bloqueada a propósito hasta que un contador valide las reglas (constitución VII) |

## 2. Qué se hizo, en orden

| # | Etapa | Resultado | Dónde |
|---|---|---|---|
| 1 | **Opinión inicial** sobre REA, SamitSQL y Alegra (sin código) y viabilidad de un sistema contable propio | Se concluyó que es viable construir un sistema propio sobre normativa pública; se descartó la ingeniería inversa de productos comerciales | §4.5 y [`04-diseno-ux/05-…`](04-diseno-ux/05-referencias-y-benchmark.md) |
| 2 | **Fase 1 — especificaciones**: arquitectura, catálogo de reglas, flujos | Documentos de arquitectura, modelo de datos, evaluación de librerías, contrato OpenAPI, reglas R-CON/R-IMP/R-FE/R-INV/R-CAR, flujos de venta, devoluciones, crédito y reposición | `01-arquitectura/`, `02-normativa-y-reglas/`, `03-procesos-y-flujos/` |
| 3 | **Ajuste de dirección técnica**: Spec Kit + Clean Architecture, Prisma en lugar de TypeORM, Zod, SaaS multiempresa, PTA, sin préstamos (ventas a crédito y cartera), módulo de inventario (ABC, ROP, PEPS/promedio, devoluciones) | Constitución (9 principios, 12 *gates*), 13 ADR, 11 specs con Gherkin, skills instaladas, `scripts/docs.mjs` y CI documental | `constitution.md`, `specs/`, `01-arquitectura/06-…` |
| 4 | **Plan y tareas de la spec 001** (`/speckit-plan`, `/speckit-tasks`) | `plan.md`, `research.md`, `data-model.md`, contrato OpenAPI validado, `quickstart.md`, `tasks.md` (94 tareas, pruebas primero) | `specs/001-…/` |
| 5 | **Implementación de la spec 001** (`/speckit-implement`) | Monorepo, backend de contabilidad completo, migraciones con inmutabilidad y RLS, pruebas, rendimiento medido | `apps/api/`, `packages/` |
| 6 | **Insumos de diseño de interfaz** (este encargo) | Brief para Claude Design, navegación, catálogo de pantallas, sistema de diseño, benchmark y hoja de captura | [`04-diseno-ux/`](04-diseno-ux/README.md) |
| 7 | **Integraciones, migración de datos y configuración** (fase F8 en el radar) | Documento [`04-diseno-ux/06-…`](04-diseno-ux/06-integraciones-migracion-y-configuracion.md): conectores, Alegra como origen (con certeza de cada dato), reglas de migración MG-01…MG-09, pantallas IN.1–IN.10, catálogo de configuración por empresa, lo no configurable; roadmap F8 y specs 013–015 propuestas. El brief se publicó además como documento compartible | `04-diseno-ux/06-…`, `00-alcance…` §7, `specs/README.md` |

## 3. Inventario de artefactos

### 3.1 Documentación (≈ 10.000 líneas)

| Ruta | Contenido |
|---|---|
| `constitution.md` | 9 principios innegociables y 12 *gates* de calidad (G-01…G-12) |
| `00-alcance-supuestos-y-roadmap.md` | Alcance, decisiones, fuera de alcance, supuestos, preguntas abiertas, riesgos, fases F1–F7 |
| `01-arquitectura/` | Módulos y capas, modelo de datos, evaluación de librerías, contrato API, integración Asia-POP (futura), ADRs, OpenAPI borrador |
| `02-normativa-y-reglas/` | 95 reglas con estado de verificación ✅/⚠️/🔶 |
| `03-procesos-y-flujos/` | Flujo de venta, devoluciones, venta a crédito, reposición y ABC |
| `specs/` | 11 especificaciones, 157 escenarios Gherkin, matriz de trazabilidad generada |
| `specs/001-…/` | Plan, investigación, modelo de datos, contratos, guía rápida, tareas, **hoja de validación del contador** |
| `04-diseno-ux/` | Brief y especificación para la maqueta |

### 3.2 Código (spec 001)

| Ruta | Contenido | Tamaño |
|---|---|---|
| `apps/api/src/` | Núcleo compartido, plataforma, módulo `accounting` (dominio, aplicación, infraestructura, presentación) | 111 archivos, ≈ 3.900 líneas |
| `apps/api/prisma/migrations/` | SQL a mano: roles, auditoría, tablas, *triggers*, RLS, privilegios | 360 líneas |
| `packages/contracts/` | Esquemas Zod (fuente única de contratos) | — |
| `apps/api/test/` | Unitarias, integración, contrato, aceptación, arquitectura, rendimiento | 59 archivos, ≈ 4.300 líneas |
| `scripts/` | `docs.mjs` (gobernanza documental) y `check-rules-verified.mjs` (puerta de liberación) | — |
| `.github/workflows/` | CI documental y de la API, y *job* `release-gate` | — |

### 3.3 Qué hace hoy el backend de contabilidad

- **Contabilizar** comprobantes de partida doble que cuadran, con consecutivo sin saltos por tipo (y por año si se
  configura), idempotencia y atomicidad (una falla en cualquier paso no deja rastro).
- **Inmutabilidad en tres niveles:** el dominio no expone edición; el rol de la aplicación no tiene `UPDATE`/`DELETE`
  sobre los comprobantes; *triggers* rechazan cualquier mutación, incluso la del propietario de las tablas.
- **Reversiones** como contraasientos; «reversado» se deduce, no se guarda.
- **Períodos:** cierre (con comprobaciones y bitácora), reapertura excepcional (permiso y motivo), cierre anual reversible.
- **Borradores** mutables que bloquean el cierre.
- **Libros:** diario, mayor con saldo acumulado y **balance de prueba** (saldo inicial, movimiento y final;
  acumulación por nivel; saldos contrarios a la naturaleza marcados, no ocultos); resultados reproducibles.
- **Multiempresa** con aislamiento por `tenant_id` y seguridad a nivel de fila **forzada**.
- **API** de 15 rutas conforme a un contrato OpenAPI validado, con errores `application/problem+json` y códigos estables.

## 4. Lo investigado y su grado de certeza

Marcadores: ✅ contrastado con una fuente que se cita (o probado empíricamente) · ⚠️ fuente secundaria · 🔶 sin
contrastar. El registro completo está en [`02-normativa-y-reglas/README.md`](02-normativa-y-reglas/README.md).

### 4.1 Normativa colombiana

| Hallazgo | Estado | Nota |
|---|---|---|
| UVT 2026 = $ 52.374 (Resolución DIAN 000238 de 2025) | ✅ | Varias fuentes concordantes; el sitio oficial no fue accesible |
| Decreto 572 de 2025 (bases y tarifas de retención) con artículos 2 a 8 **suspendidos** provisionalmente por el Consejo de Estado (mayo de 2026) | ⚠️ | Prensa y firmas; falta el texto oficial. Motivó guardar tarifas como **datos con vigencia** |
| Resolución DIAN 000165 de 2023 y Anexo Técnico v1.9 de factura electrónica | ⚠️ | ¿Hay versiones posteriores? 🔶 sin verificar |
| UEPS (LIFO) **no** es fórmula de costo admitida (NIC 2 / Sección 13 NIIF Pymes); sí PEPS y promedio ponderado | ⚠️ | Por eso UEPS queda solo como política de **despacho físico** |
| ET arts. 62–65 (inventarios y fórmulas de costo) | ⚠️ | Resúmenes secundarios |
| Fórmula del CUFE (SHA-384) y contenido del QR | 🔶 | No se accedió al Anexo oficial; vectores oficiales serán prueba obligatoria |
| Códigos de cuenta PUC a 4 dígitos | 🔶 | Del PUC clásico; el plan real lo revisa un contador |
| Reglas de comprobantes R-CON-001…014 | 🔶 → implementadas y probadas, **pendientes de validación del contador** | [`specs/001-…/validacion-contador.md`](specs/001-contabilidad-comprobantes-inmutables/validacion-contador.md) |

### 4.2 Fórmulas de gestión (no son normativa)

ABC por Pareto con acumulado previo (A hasta 80 %, B hasta 95 %) y matriz de rotación; punto de reorden
`ROP = d·L + SS` con `SS = z·√(L·σd² + d²·σL²)`. La aritmética de los ejemplos se verificó por cálculo exacto ✅; los
umbrales y niveles de servicio son **parámetros de negocio** configurables.

### 4.3 Tecnología (verificada contra el registro de npm el 14-oct-2026 y probada)

| Tema | Resultado | Estado |
|---|---|---|
| Versiones | Node ≥ 22.18, TypeScript 5.9.3, NestJS 12.1.3, Prisma 7.10.0 (estable; la 8.0 es candidata), Zod 4.6.7, decimal.js 10.6.0 | ✅ |
| Prisma: varios esquemas de PostgreSQL con `@@schema` | Funciona **sin** función en vista previa | ✅ (empírico, spike S-PRISMA-1) |
| Prisma: `set_config` para RLS y `SELECT … FOR UPDATE` dentro de la transacción; opciones de tiempo y aislamiento | Funcionan; fuera de la transacción `current_setting` devuelve cadena vacía (no nulo) | ✅ (empírico) |
| Prisma: migraciones escritas a mano y sin deriva (`migrate diff`) | Aplican y no hay diferencia con `schema.prisma` | ✅ |
| Zod 4: `z.toJSONSchema` produce patrones, límites de arreglos y uniones | Compatible con OpenAPI 3.1 | ✅ (spike S-ZOD, parcial) |
| pnpm 12: política de antigüedad mínima (1 día) y scripts de instalación bloqueados | Obligó a bajar turbo a 2.11.7 y testcontainers a 12.2.0. **El 16-oct-2026 el monorepo pasó a npm workspaces (npm ≥ 11.20.0)** | ✅ |
| Sitios no accesibles desde el entorno de redacción | `prisma.io`, DIAN, Alegra | — (se documentó como 🔶/⚠️) |

### 4.4 Rendimiento medido (spec 001)

PostgreSQL 16 local con `fsync` apagado (en servidor real los tiempos serán mayores):

| Objetivo de diseño | Medido |
|---|---|
| 1.000 contabilizaciones simultáneas del mismo tipo en ≤ 60 s, sin saltos | **6,2 s** (≈ 160/s), números 1…1000 contiguos |
| Comprobante de 50 líneas, p95 ≤ 200 ms | **p95 45 ms** |
| Balance de prueba de un mes con 1.000.000 de líneas, p95 ≤ 3 s | **p95 775 ms** |

### 4.5 Productos de referencia (REA, SamitSQL, Alegra)

Ver [`04-diseno-ux/05-referencias-y-benchmark.md`](04-diseno-ux/05-referencias-y-benchmark.md). Resumen:

- **REA** («Reverse Engineer Anything»): herramienta para analizar software compilado con IA. **No se usó.**
- **SamitSQL:** software contable colombiano de escritorio .NET (según una conversación con un asistente, 🔶 sin
  contrastar). **No se descompiló ni se analizó**; su navegación sigue **desconocida** y se resuelve con una hoja de
  captura (capturas de pantalla de una licencia o demo) en lugar de ingeniería inversa.
- **Alegra:** su API quedó documentada a partir de lo verificado por el proyecto Asia-POP (✅); su navegación es
  conocimiento general (🔶).

## 5. Decisiones principales (resumen; detalle en los ADR)

| Decisión | Motivo |
|---|---|
| **Spec Kit + constitución** como gobierno; si un ADR, spec o plan la contradice, prevalece la constitución | Evitar deriva y decidir con criterios explícitos |
| **Clean Architecture** en cuatro capas con reglas de dependencia verificadas en CI | Dominio probable sin base de datos ni framework |
| **SaaS multiempresa** con `tenant_id` y RLS forzada | Aislamiento fuerte a bajo costo |
| **Inmutabilidad contable** por dominio, privilegios y *triggers*; corrección por reversión | Evidencia contable auditable |
| **Prisma** (solo en infraestructura) + SQL explícito donde hace falta; **Zod** como fuente única de contratos | Tipado y un solo contrato |
| **Dinero exacto**: `decimal.js`, `numeric`, cadenas en la API, redondeo mitad hacia arriba por línea | Evitar errores de redondeo frente a la DIAN |
| **Reglas como datos con vigencia** y marcas ✅/⚠️/🔶; nada 🔶/⚠️ a producción sin contador | La normativa cambia (ya ocurrió con el Decreto 572) |
| **PTA** detrás del puerto `EInvoiceProvider`; Asia-POP como fase futura fuera del núcleo | No acoplar el núcleo a terceros |
| **Sin préstamos**: ventas a crédito y cartera (cupo, plazos, edades, bloqueo por mora o cupo) | SIFCA no es entidad crediticia |
| **Inventario:** PEPS o promedio; UEPS solo como despacho; ABC, ROP y devoluciones | Cumplimiento y gestión |
| **Importes como `numeric` sin precisión fija + `CHECK` de escala** | `numeric(18,2)` redondea en silencio |
| **Sin `reversed_by`**: «reversado» se deduce de otro comprobante | Tabla verdaderamente de solo inserción |

## 6. Hallazgos durante la implementación (corregidos)

| Hallazgo | Quién lo encontró | Corrección |
|---|---|---|
| El *constraint trigger* de cuadre fallaba al leer un campo que la cabecera no tiene | Prueba de integración directa a la base | Ramificación explícita en el *trigger* |
| El adaptador de auditoría rompía la regla «Prisma solo en persistencia» | Prueba de arquitectura (dependency-cruiser) | Se movió a `platform/persistence` |
| Un ciclo entre el módulo y los controladores | Prueba de ciclos | Token y tipos movidos a `application/` |
| Error intermitente «terminating connection» al borrar la base de pruebas | Ejecución repetida de la suite | El pool de Prisma ahora se cierra al apagar; pool con manejador de errores |
| `numeric(18,2)` redondeaba 1,005 a 1,01 en silencio | Diseño de pruebas de escala | `numeric` + `CHECK (scale ≤ 2)` |
| Las pruebas de arquitectura pasaban sin demostrar que detectan violaciones | Revisión crítica | Se comprobó por **mutación**: al introducir violaciones, 6 pruebas fallan |

## 7. Pendiente, riesgos y pasos siguientes

| # | Pendiente | Bloquea | Responsable |
|---|---|---|---|
| 1 | **Validación del contador** de R-CON-001…014 (hoja lista; 9 preguntas) y marcarlas ✅ en el catálogo | Liberar a producción | Contador de referencia (Q-09) |
| 2 | **Spec 012 — Identidad, roles y permisos (IAM)**: hoy la autenticación es un JWT de desarrollo y la API se niega a arrancar en producción | Primer despliegue | Producto |
| 3 | *Outbox* transaccional (spec 011): hoy los eventos se publican en memoria | Integraciones fiables | — |
| 4 | Plan y tareas de las specs **002–011** (mismo método) | Fases F3–F5 | — |
| 5 | **Maqueta de la interfaz** con Claude Design a partir de [`04-diseno-ux/`](04-diseno-ux/README.md); *spike* S-UI para elegir biblioteca | Construir el front | Producto + diseño |
| 6 | **Capturas de SamitSQL** (hoja `05-… §3`) para contrastar navegación y vocabulario | Calidad de la propuesta de UX | Quien tenga licencia o demo |
| 7 | Probar la ruta de Testcontainers/Docker (aquí se usó un PostgreSQL local) | CI en la nube | Equipo |
| 8 | Preguntas abiertas Q-04…Q-14 | Varias specs | Contador y producto |
| 9 | **F8 — Integraciones y migración**: descargar la documentación oficial de Alegra, validar con el contador las reglas MG-01…MG-09 y escribir las specs 013–015; decidir ya la tabla de referencias externas y el origen `MIGRATION` | Migrar clientes desde otro sistema | Producto, contador, arquitecto |

Riesgos principales: cambios normativos (RK-01), errores de redondeo contra la DIAN (RK-02), dependencia del PTA
(RK-03), concurrencia (RK-04 — cubierta en contabilidad con 1.000 contabilizaciones simultáneas), alcance excesivo
(RK-07). Tabla completa en [`00-alcance…`](00-alcance-supuestos-y-roadmap.md) §6.

## 8. Cómo verificar todo

```bash
node scripts/docs.mjs check --strict                        # documentación, trazabilidad y Gherkin (parser oficial)
export SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:54329/postgres   # o dejar que use Docker
infra/postgres/local-cluster.sh start                       # PostgreSQL local sin Docker
npm install && npm run build -w @sifca/contracts && npm run prisma:generate -w @sifca/api
npm run test:unit -w @sifca/api && npm run test:arch -w @sifca/api
npm run test:integration -w @sifca/api && npm run test:contract -w @sifca/api
npm run test:acceptance -w @sifca/api                    # los 21 escenarios Gherkin de la spec 001
npm run test:perf -w @sifca/api                          # carga: 1.000 simultáneas y balance de 1 M de líneas
node scripts/check-rules-verified.mjs docs/specs/001-contabilidad-comprobantes-inmutables   # falla hasta que el contador valide
```

Resultado actual: **252 pruebas** (unitarias, arquitectura, integración, contrato) y **21 escenarios** de aceptación
en verde; 3 pruebas de carga en verde; el diagrama de dependencias sin violaciones.

## 9. Mapa de lectura recomendado

1. Este informe → 2. [`constitution.md`](constitution.md) → 3. [`00-alcance…`](00-alcance-supuestos-y-roadmap.md) →
4. [`specs/001-…/plan.md`](specs/001-contabilidad-comprobantes-inmutables/plan.md) y
   [`quickstart.md`](specs/001-contabilidad-comprobantes-inmutables/quickstart.md) → 5.
   [`04-diseno-ux/README.md`](04-diseno-ux/README.md) para la maqueta.
