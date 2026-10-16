# Research — Contabilidad con comprobantes inmutables

**Fecha**: 2026-10-14 · **Spec**: [`spec.md`](spec.md) · **Plan**: [`plan.md`](plan.md)

Fase 0 de `/speckit-plan`: cada incógnita del *Technical Context* se resuelve aquí con **decisión, motivo y
alternativas descartadas**. Al final no queda ningún `NEEDS CLARIFICATION`; lo que no se pudo verificar se dice
y se convierte en una tarea de verificación o en una decisión con respaldo.

Convención de verificación (igual que el resto de `docs/`): ✅ contrastado con una fuente que se cita,
⚠️ fuente secundaria, 🔶 criterio propio sin contrastar.

---

## 1. Versiones y herramientas

Consultado en el registro de npm el 2026-10-14 (`npm view <paquete> dist-tags.latest`):

| Paquete | `latest` en npm | Decisión | Estado |
|---|---|---|---|
| Node.js | v22.22.0 en el entorno; Prisma 7.10 exige `^20.19 \|\| ^22.12 \|\| >=24`; Vitest 5 exige `^22.12 \|\| ^24 \|\| >=26` | **≥ 22.18 LTS** (`.nvmrc` = 22) | ✅ |
| TypeScript | 7.0.2 (compilador nativo); 5.9.3 es la última 5.9.x | **5.9.3 fijada**. La línea 7 es una reescritura del compilador y no se verificó con NestJS ni con los decoradores de Nest; se evalúa después como tarea aparte | ✅ versión / 🔶 compatibilidad de la 7 |
| NestJS | 12.1.3 (`engines.node >= 20`, `rxjs ^7.1`) | **12.1.x** | ✅ |
| Prisma | `latest` = 8.0.0-rc.22 (candidata); 7.10.0 es la última 7.10.x | **7.10.0 estable + `@prisma/adapter-pg` 7.10.0**; **no** se adopta una *release candidate* en el núcleo contable | ✅ |
| Zod | 4.6.7 | **4.6.x** | ✅ |
| decimal.js | 10.6.0 | **10.6.x**, solo detrás de `Money`/`Decimal` | ✅ |
| Vitest | 5.0.4 | **5.0.x** | ✅ |
| fast-check | 4.10.2 | **4.10.x** | ✅ |
| @cucumber/cucumber | 13.3.0 | **13.3.x** (soporta `# language: es`) | ✅ |
| testcontainers / @testcontainers/postgresql | 12.2.1 | **12.2.0** (misma razón: la 12.2.1 se rechaza por antigüedad mínima) | ✅ |
| dependency-cruiser | 18.6.0 | **18.6.x** | ✅ |
| pnpm / Turborepo | 12.13.0 / 2.11.8 | **pnpm 12.13.0 + Turborepo 2.11.7** (la 2.11.8 se publicó hace menos de 1 día y la política `minimumReleaseAge` de pnpm 12 la rechaza) | ✅ |

> Qué **no** se pudo verificar: la documentación de Prisma (`prisma.io`) no fue accesible desde el entorno de
> redacción. Por eso las afirmaciones sobre Prisma de este documento se apoyan en el ADR-0004 y se confirman con
> el *spike* **S-PRISMA** (ver §2). Las versiones se fijan exactas en `package.json` (sin `^`) y se actualizan
> con una tarea explícita.

> **Actualización 16-oct-2026:** el monorepo pasó de pnpm a **npm workspaces (npm ≥ 11.20.0)**; el lockfile es
> `package-lock.json` y los scripts de instalación permitidos están en `allowScripts`. Ver
> `docs/01-arquitectura/03-evaluacion-de-librerias.md` §6.

**Decisión de manejo de versiones.** Versiones exactas fijadas + `pnpm-lock.yaml` versionado; Renovate/Dependabot
propone actualizaciones por PR, nunca automáticas en `main`.

---

## 2. Prisma: un esquema por módulo y SQL a mano

**Incógnita.** ¿Puede Prisma 7.10 mapear modelos a varios esquemas de PostgreSQL (`acc`, `audit`) para cumplir D-6
(esquemas separados con privilegios distintos)? En versiones 5–6 `multiSchema` era una función de vista previa;
no pude confirmar su estado en 7.10 (documentación inaccesible; una búsqueda de la cadena en el paquete descargado
no devolvió resultados concluyentes).

> **Resultado del *spike* S-PRISMA-1 (2026-10-14):** `multiSchema` **funciona en Prisma 7.10.0 sin función en vista
> previa** (`schemas = [...]` en el `datasource` y `@@schema`). Se usa el plan A; el plan B queda descartado salvo
> que una versión futura lo cambie. Ver `03-evaluacion-de-librerias.md` §1.5.

**Decisión.**

1. Se **intenta** `@@schema("acc")` / `@@schema("audit")` con `schemas = ["acc", "audit"]` en el `datasource`
   (tarea de *spike* `S-PRISMA-1`).
2. **Plan B declarado (si el *spike* falla):** una sola `public` con prefijo de tabla (`acc_journal_entry`…),
   y los privilegios por tabla en lugar de por esquema. Cambia solo nombres: el dominio, los puertos y el SQL
   de las migraciones se parametrizan con una constante `ACC = 'acc'`/`'acc_'`. D-6 se vigila con la regla de
   `dependency-cruiser` (ningún módulo importa repositorios de otro) en lugar de con privilegios por esquema.
3. Las migraciones se generan con `prisma migrate dev --create-only` y **se editan a mano** (RLS, `REVOKE`,
   *triggers*, índices parciales). Un *test* de integración verifica que la base resultante coincide con
   `data-model.md` (consulta a `pg_catalog`), de modo que una migración regenerada sin los añadidos falla en CI.

**Alternativas descartadas.** Cambiar de ORM (la constitución fija Prisma, ADR-0004: «el ORM no se cambia por
iniciativa propia»); Knex/SQL puro solo para `acc` (dos formas de acceder a datos en el mismo módulo).

---

## 3. Inmutabilidad en tres niveles (principio I)

**Decisión.**

| Nivel | Mecanismo | Verificación |
|---|---|---|
| Dominio | `JournalEntry` y `JournalLine` no tienen *setters*; ningún repositorio expone `update`/`delete`; la reversión es un `JournalEntry` nuevo | Prueba unitaria + regla de CI que busca `update`/`delete` en los puertos de `acc` |
| Privilegios | El rol de la aplicación `sifca_app` recibe solo `SELECT, INSERT` sobre `acc.journal_entry` y `acc.journal_line`; `REVOKE UPDATE, DELETE, TRUNCATE` | Prueba de integración conectada **como `sifca_app`** ([001-06]) |
| *Triggers* | `BEFORE UPDATE OR DELETE` por fila y `BEFORE TRUNCATE` por sentencia ejecutan `audit.reject_mutation()` (función de la plataforma, compartida con `audit.audit_log`) (excepción `SQLSTATE 'P0001'`, mensaje `IMMUTABLE_RECORD`) y también protegen frente al propietario | Prueba de integración como `sifca_owner`: el *trigger* rechaza igualmente |

Mutaciones permitidas: **ninguna** en comprobantes. La referencia «este comprobante fue reversado» **no** se
guarda en el original (el modelo preliminar tenía `reversed_by`): se deduce de la existencia de un comprobante con
`reversal_of = original.id` (índice único parcial). Así `journal_entry` es verdaderamente de solo inserción
y el *trigger* no necesita excepciones.

**Alternativas descartadas.** (a) Conservar `reversed_by` con excepción en el *trigger* («solo hacia adelante»):
reabre una vía de mutación y complica la verificación de SC-002; (b) tabla de eventos separada: más piezas
sin ganancia, la consulta «¿está reversado?» es un `EXISTS` indexado.

**Cambio de documentación derivado:** actualizar `02-modelo-de-datos-preliminar.md` (quitar `reversed_by`,
reescribir INV-05, añadir `numbering_year` y `idempotency_key`). Está en `tasks.md`.

El superusuario de PostgreSQL y el propietario pueden deshabilitar *triggers* o alterar privilegios; eso queda
fuera del alcance de la aplicación y se mitiga operativamente (cuentas de administración separadas, auditoría
del servidor). 🔶 Se documenta como riesgo residual en `data-model.md`.

---

## 4. Validación del cuadre aunque falle el código (INV-01)

**Decisión.** Dos defensas independientes:

1. **Dominio**: `JournalEntry.post()` verifica `Σ debit == Σ credit` con `Money` exacto y lanza
   `EntryNotBalanced` (código `ENTRY_NOT_BALANCED`).
2. **Base de datos**: *constraint trigger* **diferido** (`DEFERRABLE INITIALLY DEFERRED`) sobre `journal_entry` y
   `journal_line` que llama a `acc.assert_entry_consistent(entry_id)`: la cabecera tiene ≥ 2 líneas,
   `total_debit = Σ debit`, `total_credit = Σ credit` y `total_debit = total_credit`. Se evalúa al *commit*, de
   modo que se pueden insertar cabecera y líneas en cualquier orden dentro de la transacción.

`CHECK ((debit > 0) <> (credit > 0))` y `CHECK (debit >= 0 AND credit >= 0)` por línea (INV-02) y `CHECK
(scale(debit) <= 2 AND scale(credit) <= 2)` para los 2 decimales (R-CON-001/009).

**Detalle de implementación.** Los *constraint triggers* solo pueden ser `AFTER ... FOR EACH ROW`; con N líneas se
ejecuta N veces. Con un máximo operativo de 500 líneas por comprobante (límite de la API, decisión §14) el costo
es aceptable; la función hace una sola agregación indexada por `entry_id`.

**Alternativas descartadas.** Validar solo en el dominio (no resiste inserciones directas); validar fila a fila
(imposible: un comprobante nunca cuadra a mitad de inserción).

---

## 5. Consecutivo sin saltos ni duplicados (R-CON-006, SC-003)

**Decisión.** Tabla `acc.voucher_sequence (tenant_id, voucher_type_id, scope_year, last_number)` con clave
primaria compuesta. Asignación **dentro de la transacción de contabilizar**:

```text
INSERT … ON CONFLICT DO NOTHING   -- asegura la fila (0 → 0)
UPDATE acc.voucher_sequence SET last_number = last_number + 1
 WHERE tenant_id = $1 AND voucher_type_id = $2 AND scope_year = $3
RETURNING last_number
```

El `UPDATE` toma un bloqueo de fila que se mantiene hasta el *commit*: las contabilizaciones del mismo tipo se
serializan y, si la transacción falla, el incremento se revierte con ella (el número no se consume — [001-08]).
Se asigna **lo más tarde posible** (después de validar y de insertar el cuerpo) para acortar el tiempo de bloqueo.
`scope_year` = año de la fecha contable si `numbering_scope = YEAR`, `0` si es `TENANT`. El comprobante guarda
`numbering_year` y la restricción `UNIQUE (tenant_id, voucher_type_id, numbering_year, number)` es la red de
seguridad.

*Trigger* sobre `voucher_sequence` (único dato mutable cerca del núcleo): solo permite
`NEW.last_number = OLD.last_number + 1` y prohíbe `DELETE`. La aplicación tiene `UPDATE` solo sobre esa columna.

**Medido (T085, 2026-10-14, PostgreSQL 16 local con `fsync=off`, 1 máquina):** 1.000 contabilizaciones simultáneas del
mismo tipo en **6,2 s** (≈160/s) con números 1…1000 contiguos; comprobante de 50 líneas **p95 45 ms** (mediana 33 ms).
Los valores en un servidor con `fsync` activo serán mayores; los objetivos del plan (60 s y 200 ms) se cumplen con holgura.

**Rendimiento.** Es un punto caliente por (tenant, tipo): el rendimiento máximo es del orden de cientos de
contabilizaciones por segundo por tipo, suficiente para el MVP. Si algún día fuera insuficiente, se tendría que
cambiar a numeración con huecos permitidos, lo cual R-CON-006 prohíbe; por eso se acepta la serialización.

**Alternativas descartadas.** `SEQUENCE` de PostgreSQL (no transaccional: deja huecos al revertir, viola
R-CON-006); `SELECT max(number)+1` (condición de carrera); asignar el número al crear el borrador (consumiría
número sin contabilizar).

---

## 6. Períodos y concurrencia con el cierre (R-CON-004, R-CON-011)

**Incógnita.** ¿Cómo se evita que se contabilice en un mes mientras otro proceso lo cierra?

**Decisión.** *Bloqueo de la fila del período*: contabilizar toma `SELECT … FROM acc.fiscal_period … FOR SHARE`
(varias contabilizaciones concurrentes caben) y verifica `status = 'OPEN'`; cerrar toma `FOR UPDATE` (espera a
que terminen las contabilizaciones en curso y bloquea las nuevas), verifica el balance, los borradores y los
`PeriodCloseCheck` registrados, y marca `CLOSED`. El *trigger* `acc.assert_period_open()` hace además un
`SELECT … FOR SHARE` propio al insertar un comprobante (defensa en profundidad, INV-04).

Reabrir: permiso `accounting.period.reopen`, motivo obligatorio, escribe en `audit.audit_log` en la misma
transacción. Cierre y reapertura **no** usan `SERIALIZABLE` (el bloqueo de fila basta y es más barato); la
sugerencia de «`SERIALIZABLE` solo para cierre de período» del documento de modelo se sustituye por este
mecanismo, con una nota en el cambio de documentación.

**Puntos de extensión.** `PeriodCloseCheck` es un puerto con múltiples implementaciones registradas por otros
módulos (conciliaciones INV-10, INV-13, INV-14). En este feature solo existen las comprobaciones propias
(balance cuadrado y sin borradores); el resto se enchufa en specs posteriores sin cambiar `ClosePeriod`.

**Cierre anual (R-CON-012).** Se implementa como un caso de uso `CloseFiscalYear` que **genera y contabiliza**
un comprobante de cierre normal por el mismo camino que cualquier otro; por tanto cumple R-CON-001…008 y es
reversible. La cuenta de ganancias y pérdidas y la de resultado del ejercicio se parametrizan por *tenant*
(R-CON-012 está 🔶: el PUC fija grupo 59 y 36 pero depende del plan de cada empresa).

**Alternativas descartadas.** Confiar solo en comprobar el estado en el caso de uso (carrera entre cierre y
contabilización); `SERIALIZABLE` global (reintentos por todas partes).

---

## 7. Fechas, zona horaria y reloj (R-CON-014)

**Decisión.**

- `LocalDate` (`YYYY-MM-DD`) es un objeto de valor del `shared-kernel` sin `Date` interno; se persiste como `DATE`.
- `Instant` (`Date` UTC) solo entra por el puerto `Clock`: `now(): Instant` y `toLocalDate(instant): LocalDate`
  (convierte a `America/Bogota` con `Intl.DateTimeFormat`, implementado en `platform/time`). El dominio **nunca**
  llama a `Date.now()`; recibe valores ya resueltos (G-01).
- El caso de uso `PostJournalEntry` acepta `accountingDate` explícita (`LocalDate`) **o** `occurredAt` (instante
  UTC) del que deriva la fecha en hora de Colombia ([001-13]: 23:30 hora Colombia del 31 de octubre = 04:30 UTC
  del 1 de noviembre ⇒ fecha contable 2026-10-31).
- Pruebas de reloj fijo con `FixedClock`.

Colombia no usa horario de verano actualmente 🔶; usar `Intl` con la zona `America/Bogota` evita fijar el
desfase a mano.

**Alternativas descartadas.** `date-fns-tz`/`luxon` (dependencia extra para una sola conversión); `Temporal`
(no disponible de forma estable en Node 22).

---

## 8. Dinero y redondeo (R-CON-009, principio VI)

**Decisión.**

- `Money` = `decimal.js` configurado localmente (`Decimal.clone({ precision: 40, rounding: ROUND_HALF_UP })`) para
  no tocar el estado global de la librería; escala fija 2 en COP; constructor solo desde cadena o `Decimal`,
  **nunca desde `number`** (error de tipo y de ejecución).
- `Money.percentOf(Percentage)` redondea mitad hacia arriba **por línea**; `Money.sum(lines)` suma ya redondeadas
  (R-CON-009.3). El escenario [001-10] (3 × 333,33 con IVA 19 % ⇒ 63,33 por línea, 189,99 total) se prueba contra
  esta utilidad; el motor de impuestos completo pertenece a otra spec.
- Persistencia: `NUMERIC(18,2)`; el mapper convierte `Prisma.Decimal` ↔ `Money` por cadena. Lecturas por
  `$queryRaw` hacen `::text` para no pasar por `number`.
- API: cadenas decimales (`"1190000.00"`), validadas con el esquema `Money` de `packages/contracts`
  (`/^\d+(\.\d{1,2})?$/` en entradas; nunca negativas en comprobantes).
- Regla de lint: prohibido el tipo `number` en `domain/` para campos monetarios (regla ESLint personalizada o
  `@typescript-eslint/no-restricted-types` + convención de sufijos), más una prueba de arquitectura.

**Alternativas descartadas.** `bignumber.js` (equivalente; ya está decidido decimal.js en la Fase 1);
representar centavos como `bigint` (los costos unitarios con 6 decimales y los porcentajes lo complican;
ver R-CON-009.2).

---

## 9. Unit of Work reentrante (G-04)

**Incógnita.** Los módulos comerciales (ventas, inventario) deben contabilizar **dentro de su propia
transacción** (principio III). ¿Cómo lo hace `accounting` sin acoplarse?

**Decisión.** `UnitOfWork.run(fn, options?)` (puerto en `shared-kernel`) es **reentrante**: si ya existe una
transacción en el contexto asíncrono (`AsyncLocalStorage`), `fn` se une a ella; si no, abre
`prisma.$transaction(…, { maxWait: 5000, timeout: 15000, isolationLevel: ReadCommitted })` y fija
`set_config('app.tenant_id', $tenant, true)`. Los repositorios obtienen el cliente transaccional del contexto
(`TransactionContext.current()`), nunca de un parámetro global. El módulo expone en `index.ts` el puerto
`PostJournalEntryPort` que los consumidores definirán/importarán por su fachada (D-5): ejecuta el mismo caso de
uso y comparte la transacción ambiente.

Los valores `maxWait`/`timeout` por defecto son parámetros de configuración (🔶 a calibrar con la prueba de
carga); la constitución solo exige que sean **explícitos**.

**Alternativas descartadas.** Pasar `tx` explícitamente por todas las firmas (contamina dominio y aplicación con
un tipo de infraestructura); un `UnitOfWork` no reentrante (el consumidor tendría que contabilizar fuera de su
transacción: viola III).

---

## 10. Aislamiento por *tenant* (principio IV)

**Decisión.** Todas las tablas de `acc` y `audit` llevan `tenant_id uuid NOT NULL`, `ENABLE` **y** `FORCE ROW LEVEL
SECURITY` y una política única `USING/WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)`.
`set_config('app.tenant_id', id, true)` (local a la transacción) se ejecuta al abrir cada transacción (`UnitOfWork`).
El rol `sifca_app` no es propietario ni `BYPASSRLS`. Las consultas de solo lectura (`TrialBalanceReader`) también
corren en una transacción de solo lectura que fija el *tenant* (`SET TRANSACTION READ ONLY`), de modo que no hay
conexión de aplicación sin RLS. Si la variable no está fijada, `current_setting(…, true)` devuelve `NULL` y la
política no deja ver ni escribir nada (fallo seguro).

Prueba de aislamiento: dos *tenants* con datos; con el contexto de A, un `SELECT` sobre cualquier tabla de `acc`
no devuelve filas de B y un `INSERT` con `tenant_id` de B falla; sin contexto no devuelve filas (G-07).

---

## 11. Autorización y contexto de solicitud (aún no existe IAM)

**Incógnita.** Ninguna spec cubre autenticación, usuarios y permisos (`accounting.entry.post`,
`accounting.period.close`, `accounting.period.reopen`…). **Hallazgo:** falta una spec de IAM (identidad y acceso).

**Decisión.** Este feature depende de dos puertos de `shared-kernel`: `RequestContext` (`tenantId`, `userId`,
`permissions`) y `PermissionChecker.assert(permission)`. Su adaptador provisional (`platform/http`) lee un JWT
firmado de desarrollo/pruebas con *claims* `tid`, `sub` y `perms`; **no es un sistema de seguridad de producción**.
Se registra la **spec 012 — Identidad, roles y permisos (IAM)** como dependencia a crear antes del primer
despliegue (anotado en `specs/README.md`). Los permisos usados por este feature quedan listados en `ports.md`.

**Alternativas descartadas.** Construir IAM aquí (amplía el alcance de una spec contable); omitir permisos
(contradice R-CON-004: reabrir exige permiso).

---

## 12. Bitácora de auditoría

**Decisión.** Las operaciones sensibles (cerrar, reabrir un período; cierre anual) escriben en `audit.audit_log`
(append-only: mismos tres niveles de protección) dentro de la misma transacción: `tenant_id, actor_id,
action, entity_type, entity_id, reason, before, after, occurred_at`. La tabla y el puerto `AuditLog` se crean en
la migración `platform_roles_audit` porque ninguna otra spec la ha creado todavía; **no pertenece al módulo
`accounting`**: se declara en `platform/persistence` y la futura spec de auditoría la adopta. Lo que `accounting` ve es
solo el puerto `AuditLog.record(entry)` (D-6 respetado: no lee ni escribe tablas ajenas; las escribe el adaptador
de la plataforma).

Reabrir un período exige `reason` (texto no vacío) en la entrada del caso de uso.

---

## 13. Borradores (necesarios para R-CON-011 y el escenario [001-12])

**Decisión.** Tabla **mutable** `acc.journal_draft` (cabecera + `lines jsonb`; no es registro contable: admite
editar y borrar). Funciones mínimas de este feature: **guardar** un borrador (crear o reemplazar su
contenido), **descartarlo** (`DELETE` permitido solo sobre borradores) y **listarlos**. Los borradores:

- no consumen consecutivo ni afectan saldos;
- se validan con el mismo esquema Zod que un comprobante pero con tolerancia a descuadre;
- se cuentan por período para bloquear el cierre.

**Fuera de este feature (a clarificar):** «contabilizar desde un borrador» (hoy se envía el cuerpo completo a
`POST /journal-entries`). Se anota como pendiente en `docs/specs/README.md` si el usuario lo necesita; el modelo ya
lo admite añadiendo `draftId` opcional. No bloquea ninguna historia.

**Alternativas descartadas.** Estado `DRAFT` en `journal_entry` (mezclaría datos mutables con la tabla
inmutable y rompería el *trigger*); no tener borradores (deja sin ejercer R-CON-011).

---

## 14. API: límites, errores e idempotencia

**Límites.** Un comprobante admite entre 2 y **500 líneas**; descripción ≤ 500 caracteres; referencia de
documento ≤ 60. 🔶 Son parámetros de configuración, no normativa.

**Errores** (`application/problem+json`, RFC 9457, ya definidos en `04-contrato-api-y-swagger.md`):

| `code` | HTTP | Cuándo |
|---|---|---|
| `ENTRY_NOT_BALANCED` | 422 | Σ débitos ≠ Σ créditos ([001-02]) |
| `VALIDATION_FAILED` | 422 | Esquema inválido, línea con ambos lados/negativa/cero, cuenta no auxiliar o inactiva, falta tercero o centro de costo ([001-03], [001-04], [001-09]); el detalle va en `errors[]` con `field`, `message` y `rule` (`R-CON-00x`) |
| `PERIOD_CLOSED` | 409 | Fecha en período cerrado ([001-05]) |
| `PERIOD_NOT_FOUND` | 422 | La fecha no pertenece a ningún período creado (caso «fecha futura») |
| `ALREADY_REVERSED` | 409 | El comprobante ya tiene reversión ([001-07]) |
| `ENTRY_IMMUTABLE` | 405 | `PUT/PATCH/DELETE` sobre un comprobante ([001-06]) |
| `PERIOD_CLOSE_BLOCKED` | 409 | Cierre rechazado por borradores o balance descuadrado ([001-12]); `errors[]` lista las causas |
| `FORBIDDEN` | 403 | Falta el permiso |
| `IDEMPOTENCY_CONFLICT` | 422 | Misma `Idempotency-Key` con otro cuerpo |

**Idempotencia mínima.** `POST /journal-entries` acepta `Idempotency-Key`. Se guarda `idempotency_key` y
`request_hash` (SHA-256 del cuerpo canónico) en el comprobante, con `UNIQUE (tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL`. Misma clave y mismo hash ⇒ `200` con el comprobante existente; mismo hash
distinto ⇒ `IDEMPOTENCY_CONFLICT`. La política completa (retención de 24 h, otras rutas) la define la spec 011;
aquí es el mínimo para que reintentos de red no dupliquen comprobantes.

**Reversión.** `POST /journal-entries/{id}/reversal` con `reason` obligatorio y `accountingDate` opcional
(por defecto, la fecha de hoy en hora de Colombia; debe caer en un período abierto — R-CON-004). El texto de
R-CON-005 («se fecha en el período abierto actual salvo que el original sea del mismo período abierto») es ambiguo 🔶:
se implementa como «fecha explícita o, si se omite, hoy», y el contador debe confirmarlo al validar R-CON-005.
La reversión copia tercero, centro de costo, referencia y vencimiento, invierte los lados y guarda `reversal_of`.
Reversar una reversión es válido (restituye el efecto original) y genera otro comprobante; reversar dos veces el
mismo comprobante es `ALREADY_REVERSED` (índice único parcial en `reversal_of`).

---

## 15. Libros y balance de prueba (R-CON-010, R-CON-013, SC-004)

**Decisión.**

- **Balance de prueba**: agregación SQL sobre `journal_line` (con `tenant_id` y `accounting_date` denormalizados
  → sin *join*), por cuenta auxiliar con saldo inicial (antes de `from`), movimiento del rango y saldo final;
  parámetro `level` (1, 2, 4, 6, 8) para acumular por prefijo del código. Resultado en cadenas decimales.
- **Saldo por lado**: el saldo final se muestra en la columna donde queda positivo (`closingDebit` o
  `closingCredit`); si es contrario a la naturaleza de la cuenta se marca `contraNature: true` (R-CON-013: se
  muestra con alerta, no se oculta). Esto reproduce el cuadro de [001-11] (4175 queda en débito).
- **Reproducibilidad (R-CON-010)**: orden determinista (`ORDER BY account code, entry number`), sin dependencia
  de hora actual ni de campos no determinísticos en el cuerpo; la prueba compara el hash SHA-256 de dos
  ejecuciones sucesivas.
- **Diario**: lista cronológica `(accounting_date, voucher_type, number, line_no)`, paginación por cursor sobre
  esa clave compuesta. **Mayor**: movimientos por cuenta con saldo acumulado calculado por ventana SQL.
- **Medido (T085)**: balance de prueba de un mes con **1.000.000 de líneas**: **p95 775 ms**, mediana 566 ms (objetivo ≤ 3 s), con la agregación sobre `journal_line` sin vista materializada; la carga de 1 M de líneas tardó 13 s. Por eso la vista materializada de períodos cerrados **no** se construye todavía.
- **Rendimiento**: índice `journal_line (tenant_id, account_id, accounting_date)`; el modelo preliminar ya prevé
  congelar el balance de períodos cerrados (vista materializada). **No se incluye** en este feature; se decide por
  métricas de la prueba de carga (evitar optimización prematura).
- Fixture de referencia ([001-11]): se construye **contabilizando** (a través del caso de uso) los comprobantes
  de venta, nota crédito y recibo definidos en `01-contabilidad-partida-doble-y-puc.md` y se compara con la tabla
  esperada; no se inserta SQL directo.

**Plan de cuentas de prueba.** Los escenarios usan cuentas de 4 dígitos (1105, 1110, 1435, 2408, 3115, 4135, 4175,
6135) como *cuentas de movimiento*, y `13` como grupo acumulador, mientras que el PUC clásico considera las de 4
dígitos acumuladoras (el catálogo permite que la empresa decida el nivel de movimiento). Decisión: el **plan de
cuentas de prueba** (`test/fixtures/plan-de-cuentas-de-prueba.ts`) marca esas cuentas como `allows_posting = true`
y `130505` como auxiliar con `requires_party = true`; **no es** el PUC que se siembre en producción (ese lo
revisa un contador — `02-normativa-y-reglas/01-…`).

---

## 16. Estrategia de pruebas (principio VIII)

| Nivel | Qué cubre | Herramienta | Escenarios / requisitos |
|---|---|---|---|
| Unitarias de dominio | `JournalEntry`, `Money`, `ReversalFactory`, `TrialBalanceCalculator`, `PeriodClosePolicy` | Vitest + fast-check | R-CON-001/002/003/005/008/009/013; propiedad: cualquier lista válida cuadra ⇔ `post()` tiene éxito; reversión suma cero por cuenta |
| Aplicación | Casos de uso con repositorios en memoria y `FixedClock` | Vitest | US1–US3, orden de validaciones, errores |
| Integración | Triggers, privilegios del rol, RLS, atomicidad (falla inyectada), concurrencia de consecutivos, cierre vs. contabilización | Vitest + Testcontainers PostgreSQL con los 3 roles | [001-06], [001-08]; SC-002, SC-003 |
| Aceptación | Los `.feature` de la spec ejecutados tal cual | Cucumber (`# language: es`) contra el caso de uso y Postgres real | [001-01]…[001-13] |
| Contrato | Respuestas reales ⊂ `accounting.v1.openapi.yaml`; OpenAPI generado por Nest ≈ contrato | supertest + `openapi-spec-validator` | FR-001…014 |
| Arquitectura | D-1…D-7, ausencia de ciclos, `number` monetario, `update/delete` en puertos | dependency-cruiser + pruebas | G-01, G-03, G-06, G-09 |
| Carga | 1.000 contabilizaciones simultáneas; balance de 1.000.000 de líneas | k6 o script con `pg` | SC-003 y *Performance Goals* |

**Cumplimiento de «escenario sin prueba».** El *script* `docs.mjs` ya garantiza que cada regla tenga escenario;
`tasks.md` añade una tarea de prueba por escenario y, a nivel de CI, un paso que falla si un `.feature` queda
sin ningún *step definition* (Cucumber `--strict`, escenarios `undefined`/`pending` fallan).

Orden **primero la prueba** (principio VIII): en cada historia, las tareas de prueba preceden a las de
implementación y deben fallar antes de implementar.

---

## 17. Cosas que este feature no resuelve (trazadas)

| Tema | Dónde se resuelve |
|---|---|
| Autenticación, usuarios, roles | Spec 012 (IAM) por crear — dependencia declarada en §11 |
| *Outbox* y publicación fiable de eventos | Spec 011 |
| Plantillas de asientos automáticos desde documentos (venta, recibo…) | Specs 002 y posteriores; este feature solo expone `PostJournalEntryPort` |
| Plan de cuentas inicial (PUC sembrado) | Revisión de contador; fuera de este feature (se usa un plan de pruebas) |
| Estados financieros NIIF | Fase posterior (solo reportes de comprobantes aquí) |
| Validación de reglas por el contador (R-CON-001…009, 013) | Tarea de cierre del feature; sin ella, sin producción (G-10) |

## 18. Resumen de decisiones

| # | Decisión |
|---|---|
| 1 | Versiones fijadas y verificadas en npm; Prisma 7.10 estable, no RC; TypeScript 5.9.3 |
| 2 | Esquemas `acc`/`audit` con `@@schema`; plan B por prefijo si `multiSchema` no está disponible |
| 3 | Inmutabilidad: dominio + `REVOKE` + *triggers* (incluye `TRUNCATE` y propietario); sin `reversed_by` |
| 4 | Cuadre en dominio y *constraint trigger* diferido; `CHECK` por línea |
| 5 | Consecutivo con `UPDATE … RETURNING` bajo bloqueo en la misma transacción |
| 6 | Bloqueo de fila del período (`FOR SHARE` / `FOR UPDATE`), no `SERIALIZABLE` |
| 7 | `LocalDate`/`Instant` + `Clock`; fecha contable derivada de la hora de Colombia |
| 8 | `Money` sobre decimal.js, mitad hacia arriba por línea, nunca `number` |
| 9 | `UnitOfWork` reentrante con `AsyncLocalStorage` |
| 10 | RLS forzada con `set_config(…, true)`; fallo seguro sin contexto |
| 11 | `RequestContext`/`PermissionChecker` como puertos; IAM pendiente (spec 012) |
| 12 | `audit.audit_log` append-only en la plataforma, vía puerto `AuditLog` |
| 13 | Borradores mutables mínimos (guardar, descartar, listar) |
| 14 | Límites de la API, mapa de errores, idempotencia mínima y reglas de reversión |
| 15 | Balance de prueba por SQL con saldo inicial/movimiento/final y `contraNature`; libros reproducibles |
| 16 | Pirámide de pruebas con los `.feature` de la spec ejecutados tal cual |
