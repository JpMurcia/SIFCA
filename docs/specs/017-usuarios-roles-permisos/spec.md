# Feature Specification: Usuarios, roles y permisos

**Feature Branch**: `017-usuarios-roles-permisos`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "SPEC-017 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 1): usuarios por empresa
(invitar, desactivar), roles con matriz de permisos granulares `modulo.recurso.accion`, roles base (Administrador,
Contador, Auxiliar contable, Vendedor/POS, Cartera, Bodega, Solo lectura), verificación declarativa del permiso en cada
operación, consulta «¿quién puede hacer X?», solicitud de permiso, segundo factor opcional por usuario y bitácora de
cambios; reemplaza el adaptador provisional de permisos de la spec 001. Maquetas: usuarios y roles con matriz 7u/7v,
bitácora 3o/3p, 403 7af/7ag, toast FORBIDDEN 5q."

## Contexto

La spec 012 entrega la identidad y la membresía de un usuario en una empresa. Esta spec define **qué puede hacer** cada
miembro: un catálogo de permisos granulares agrupados en roles, administrado por la propia empresa y aplicado en
**cada** operación de la API. Los permisos que ya usa la spec 001 (`accounting.entry.post`, `accounting.period.reopen`…)
son el primer contenido del catálogo; cada spec posterior agrega los suyos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invitar y administrar usuarios de la empresa (Priority: P1)

La administradora invita a un auxiliar por correo, le asigna el rol «Auxiliar contable» y, cuando deja la empresa, lo
desactiva. El invitado define su contraseña desde el enlace de invitación.

**Why this priority**: sin alta de usuarios cada empresa depende de soporte para operar.

**Independent Test**: invitar, aceptar la invitación, entrar con el nuevo usuario y desactivarlo.

**Acceptance Scenarios**:

1. **Dado** una administradora, **Cuando** invita a `aux@andina.com` con el rol «Auxiliar contable», **Entonces** se
   envía un enlace de invitación válido 72 horas y el usuario aparece como «Invitado».
2. **Dado** el enlace, **Cuando** el invitado define su contraseña, **Entonces** su membresía queda «Activa» y entra
   con los permisos del rol.
3. **Dado** un usuario activo, **Cuando** la administradora lo desactiva con motivo, **Entonces** sus sesiones en esa
   empresa se cierran de inmediato y no puede volver a entrar a ella.
4. **Dado** que un correo ya tiene cuenta en otra empresa, **Cuando** se le invita, **Entonces** se le agrega una
   membresía sin crear otra cuenta ni cambiar su contraseña.

---

### User Story 2 - Roles con matriz de permisos (Priority: P1)

La administradora ve una matriz de permisos por módulo y rol, parte de los roles base, crea roles propios y ajusta qué
puede hacer cada uno. Ningún cambio deja a la empresa sin administrador.

**Why this priority**: es el control que exige el catálogo (Parte D) y la segregación de funciones contables
(quien contabiliza no siempre puede cerrar el mes ni reabrirlo).

**Independent Test**: quitar `accounting.period.close` al rol Contador y comprobar que un contador ya no puede cerrar.

**Acceptance Scenarios**:

1. **Dado** una empresa nueva, **Entonces** existen los roles base con sus permisos predefinidos (ver Assumptions).
2. **Dado** la matriz, **Cuando** la administradora quita un permiso a un rol y guarda, **Entonces** los usuarios con
   ese rol lo pierden a más tardar en su siguiente renovación de sesión (≤ 15 minutos).
3. **Dado** una sola administradora activa, **Cuando** intenta quitarse el rol Administrador o desactivarse,
   **Entonces** el sistema lo impide con «La empresa debe tener al menos un administrador activo».
4. **Dado** el rol base «Administrador», **Cuando** se intenta quitarle `iam.role.manage`, **Entonces** se impide
   (los permisos de administración del rol base son fijos).

---

### User Story 3 - Toda operación exige su permiso (Priority: P1)

Cada operación de la API declara el permiso que exige; sin él responde `403 FORBIDDEN` con el permiso indicado. Ninguna
operación nueva puede publicarse sin declarar su permiso.

**Why this priority**: es la garantía que reemplaza el adaptador provisional de la spec 001.

**Independent Test**: recorrer todas las operaciones con un usuario sin permisos y verificar `403` en cada una.

**Acceptance Scenarios**:

1. **Dado** un usuario con solo `accounting.report.read`, **Cuando** intenta contabilizar, **Entonces** recibe `403
   FORBIDDEN` con `accounting.entry.post` en el detalle y no se escribe nada.
2. **Dado** una operación nueva sin permiso declarado, **Cuando** corre la verificación del CI, **Entonces** falla
   nombrando la operación.
3. **Dado** los escenarios de la spec 001, **Cuando** se ejecutan con usuarios reales y sus roles, **Entonces** todos
   pasan sin el adaptador provisional.

---

### User Story 4 - Saber quién puede hacer algo y pedir acceso (Priority: P2)

Cuando a un usuario le falta un permiso, ve quién puede concederlo y puede solicitarlo con un clic; los administradores
reciben la solicitud y la aprueban (asignando un rol) o la rechazan.

**Why this priority**: la maqueta `5q` y la página 403 `7af` lo muestran; reduce bloqueos operativos.

**Independent Test**: un auxiliar pide `accounting.period.reopen`; la administradora la ve y la rechaza con motivo.

**Acceptance Scenarios**:

1. **Dado** un usuario sin `accounting.period.reopen`, **Cuando** ve el aviso de permiso, **Entonces** se listan los
   usuarios que sí lo tienen (nombre y rol), sin correos ni datos personales adicionales.
2. **Dado** que pulsa «Solicitar permiso», **Entonces** se crea una solicitud y los administradores la ven en sus
   alertas; pedir de nuevo lo mismo mientras esté pendiente no crea otra.
3. **Dado** una solicitud, **Cuando** un administrador la aprueba asignando un rol o la rechaza con motivo,
   **Entonces** el solicitante recibe la respuesta y la bitácora registra la decisión.

---

### User Story 5 - Segundo factor opcional (Priority: P2)

Un usuario activa un segundo factor con una aplicación de códigos de un solo uso; desde entonces, al entrar, además de
su contraseña escribe el código. La empresa puede exigirlo a ciertos roles.

**Why this priority**: protege cuentas con permisos sensibles (cerrar o reabrir períodos, administrar usuarios).

**Independent Test**: activar el segundo factor, entrar con y sin código válido, y usar un código de respaldo.

**Acceptance Scenarios**:

1. **Dado** un usuario, **Cuando** activa el segundo factor escaneando el código y confirmando uno válido, **Entonces**
   recibe 10 códigos de respaldo de un solo uso que se muestran una sola vez.
2. **Dado** el segundo factor activo, **Cuando** entra con contraseña correcta y código errado, **Entonces** no entra
   y el fallo cuenta para el bloqueo de la spec 012.
3. **Dado** que la empresa exige segundo factor al rol Administrador, **Cuando** un administrador sin segundo factor
   entra, **Entonces** debe activarlo antes de continuar.

---

### User Story 6 - Bitácora de seguridad y de permisos (Priority: P3)

La administradora consulta quién invitó, desactivó o cambió roles y permisos, cuándo y por qué.

**Why this priority**: trazabilidad exigida por auditoría; útil, pero no bloquea la operación.

**Independent Test**: hacer cambios de rol y consultar la bitácora filtrando por usuario y por tipo de evento.

**Acceptance Scenarios**:

1. **Dado** un cambio en la matriz de un rol, **Entonces** la bitácora guarda permisos agregados y quitados, autor,
   instante y motivo.
2. **Dado** la bitácora, **Cuando** se filtra por usuario afectado y rango de fechas, **Entonces** muestra solo esos
   eventos y no ofrece borrar ni editar ninguno.

### Edge Cases

- **Permiso inexistente** en una matriz (p. ej. escrito a mano por la API): se rechaza con `VALIDATION_FAILED`.
- **Rol en uso** que se intenta eliminar: se impide mientras tenga miembros; se ofrece reasignarlos.
- **Invitación a un correo ya invitado y pendiente**: se reenvía el enlace (el anterior se invalida), no se duplica.
- **Invitación vencida**: el enlace muestra «La invitación venció» y pide a la empresa reenviarla.
- **Usuario con varios roles**: sus permisos son la unión de los permisos de sus roles.
- **Administrador que se desactiva a sí mismo** siendo el último: se impide (US2-3).
- **Cambio de permisos con el usuario en plena acción**: la operación en curso se evalúa con los permisos vigentes al
  recibirla; la siguiente renovación aplica los nuevos.
- **Pérdida del dispositivo del segundo factor**: un código de respaldo o un administrador (con motivo) lo restablece.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Los permisos MUST tener la forma `modulo.recurso.accion` y vivir en un **catálogo** versionado que cada módulo amplía al registrar sus operaciones; asignar un permiso fuera del catálogo MUST rechazarse *(P-V, ADR-0009)*.
- **FR-002**: Toda operación de la API MUST declarar el permiso que exige o declararse explícitamente pública o de solo sesión; una verificación automática del CI MUST fallar ante una operación sin declaración *(P-IV, ADR-0001)*.
- **FR-003**: Sin el permiso requerido la API MUST responder `403 FORBIDDEN` con el permiso en el detalle, antes de cualquier escritura *(P-IV)*.
- **FR-004**: Los permisos efectivos de un usuario en una empresa MUST ser la unión de los permisos de sus roles en esa membresía; viajan en la credencial de acceso y se recalculan en cada renovación *(P-IV, ADR-0002)*.
- **FR-005**: Cada empresa MUST recibir al crearse los roles base Administrador, Contador, Auxiliar contable, Vendedor/POS, Cartera, Bodega y Solo lectura con los permisos de la tabla de Assumptions *(P-IV)*.
- **FR-006**: Un administrador MUST poder crear, renombrar y eliminar roles propios (sin miembros) y editar su matriz de permisos agrupada por módulo; los roles base MUST poder ajustarse salvo los permisos de administración del rol Administrador *(P-IV)*.
- **FR-007**: Una empresa MUST tener siempre al menos un miembro activo con el rol Administrador; toda operación que lo impida MUST rechazarse *(P-IV)*.
- **FR-008**: Un administrador MUST poder invitar por correo con uno o más roles; la invitación MUST vencer a las 72 horas, invalidarse al reenviarse y, si el correo ya tiene cuenta, agregar solo la membresía *(P-IV, ADR-0002)*.
- **FR-009**: Desactivar una membresía MUST exigir motivo (5–500 caracteres), cerrar de inmediato las sesiones del usuario en esa empresa e impedir nuevas, sin afectar sus otras empresas *(P-IV, P-I)*.
- **FR-010**: La API MUST responder «¿quién puede hacer X?» devolviendo nombre y rol de los miembros activos que tienen el permiso X, a cualquier miembro de la empresa *(P-IV)*.
- **FR-011**: Un miembro MUST poder solicitar un permiso; la solicitud MUST ser única mientras esté pendiente, llegar a los administradores como alerta y resolverse con aprobación (asignando un rol) o rechazo con motivo *(P-IV, P-I)*.
- **FR-012**: Un usuario MUST poder activar un segundo factor por códigos de un solo uso basados en tiempo, con 10 códigos de respaldo de un solo uso mostrados una sola vez; la empresa MUST poder exigirlo por rol *(P-IV)*.
- **FR-013**: Invitaciones, activaciones, desactivaciones, cambios de rol y de matriz, solicitudes y resoluciones, y cambios del segundo factor MUST registrarse en la bitácora con autor, afectado, valores anterior y nuevo, motivo e instante; la bitácora MUST ser de solo lectura *(P-I)*.
- **FR-014**: El adaptador provisional de permisos de la spec 001 MUST reemplazarse por esta verificación; los escenarios de la spec 001 MUST pasar con usuarios y roles reales *(P-VIII)*.
- **FR-015**: Usuarios, membresías, roles y solicitudes MUST quedar aislados por empresa: un administrador de la empresa A MUST NOT ver ni modificar nada de la empresa B *(P-IV, ADR-0002)*.
- **FR-016**: El back-office MUST ofrecer las pantallas de usuarios, roles con matriz, solicitudes de permiso y bitácora de seguridad con los estados globales de la spec 016, y su página 403 MUST mostrar quién puede conceder el permiso *(ADR-0001)*.

### Key Entities *(include if feature involves data)*

- **Permiso**: identificador `modulo.recurso.accion`, módulo, descripción, si es sensible (pide motivo o segundo
  factor por política).
- **Rol**: empresa, nombre, si es base, conjunto de permisos, exigencia de segundo factor.
- **Membresía** (de la spec 012): usuario, empresa, estado (invitado, activo, desactivado), roles.
- **Invitación**: empresa, correo, roles, vencimiento, estado.
- **Solicitud de permiso**: empresa, solicitante, permiso, estado (pendiente, aprobada, rechazada), resolución.
- **Segundo factor**: usuario, secreto protegido, códigos de respaldo (resumen), activo desde.
- **Evento de auditoría de acceso**: tipo, autor, afectado, valores anterior/nuevo, motivo, instante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las operaciones de la API tiene un permiso o una declaración pública/de sesión (verificación
  automática en CI).
- **SC-002**: Un usuario sin el permiso requerido obtiene `403` en el 100 % de las operaciones protegidas en la batería
  de pruebas, sin escrituras.
- **SC-003**: Un permiso retirado deja de servir en ≤ 15 minutos; una membresía desactivada, en la siguiente petición.
- **SC-004**: Una administradora invita a un usuario y le asigna un rol en menos de 1 minuto.
- **SC-005**: Ninguna operación deja a una empresa sin administrador activo (prueba exhaustiva de las operaciones de
  usuarios y roles).

## Assumptions

- **Roles base y permisos iniciales** (se amplían con cada spec):

  | Rol | Permisos iniciales |
  |---|---|
  | Administrador | Todos, incluidos `iam.user.manage`, `iam.role.manage`, `iam.audit.read` |
  | Contador | Todos los `accounting.*` y la lectura de todos los módulos |
  | Auxiliar contable | `accounting.entry.post`, `accounting.report.read` |
  | Vendedor/POS | Permisos de ventas y POS de las specs 002/022/025 cuando existan |
  | Cartera | Permisos de cartera de las specs 003/022 cuando existan |
  | Bodega | Permisos de inventario de las specs 006–008 cuando existan |
  | Solo lectura | Todos los permisos `*.read` |

- **Alta de empresas:** crear una empresa nueva (*tenant*) y su primer administrador es una operación de plataforma
  (semilla o consola interna), fuera de esta spec.
- **Permisos por registro** (p. ej. «solo sus propias facturas») y por sucursal: fuera de alcance.
- **Notificaciones** de invitación y de solicitudes: por correo (puerto de notificaciones de la spec 012) y en la
  campana de alertas del cascarón.
- **Segundo factor:** solo códigos basados en tiempo (TOTP); SMS y llaves físicas quedan fuera.

## Trazabilidad de reglas

Esta especificación se rige por los principios de la [constitución](../../constitution.md) I (bitácora de solo
lectura), IV (aislamiento y control de acceso), V y VIII, y por los ADR-0001, ADR-0002 y ADR-0009, más el invariante
INV-11 del [modelo de datos](../../01-arquitectura/02-modelo-de-datos-preliminar.md). La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/usuarios-roles-permisos.feature`](acceptance/usuarios-roles-permisos.feature). Permisos ya usados por la
spec 001: [`contracts/ports.md`](../001-contabilidad-comprobantes-inmutables/contracts/ports.md) §5. Maquetas: `7u/7v`,
`3o/3p`, `7af/7ag`, `5q`. Depende de la spec 012.

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | La evaluación de permisos y la regla «siempre un administrador» son dominio puro; el *guard* HTTP es presentación |
| G-06 | La bitácora de accesos es de solo inserción |
| G-07 | Roles, membresías, invitaciones y solicitudes con `tenant_id`, RLS y prueba de aislamiento |
| G-08 | Entradas validadas con esquemas de `packages/contracts` |
| G-11 | Escenarios `[017-01]…[017-11]` etiquetados |
| G-12 | Sin dependencias de proveedores externos de identidad |
