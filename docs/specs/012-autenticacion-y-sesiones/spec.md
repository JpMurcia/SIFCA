# Feature Specification: Autenticación y sesiones

**Feature Branch**: `012-autenticacion-y-sesiones`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "SPEC-012 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 1): inicio de sesión con
correo y contraseña; credencial de acceso de vida corta y credencial de renovación rotativa con detección de
reutilización; sesiones por dispositivo con revocación; cierre por inactividad; bloqueo progresivo por intentos
fallidos; recuperación de contraseña por enlace de un solo uso; selección de empresa cuando el usuario pertenece a
varias. Reemplaza el adaptador provisional de desarrollo de la spec 001 y habilita la publicación a producción del
back-office (spec 016, FR-021). Maquetas: 2a/2b, 2k/2o, 6u/6v, sesión vencida en 5q, empresa y multiempresa 3q."

## Contexto

Hoy la API acepta un token de desarrollo firmado con un secreto compartido y se niega a arrancar en producción
(spec 001, research §11); el back-office tampoco puede compilarse para producción (spec 016, FR-021). Esta spec
entrega la **identidad real**: quién es el usuario, a qué empresas pertenece y cómo se mantiene su sesión de forma
segura. **Qué puede hacer** cada usuario (roles y permisos) es la spec 017; aquí los permisos se leen de la
membresía del usuario en la empresa, que la spec 017 administra.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión y trabajar (Priority: P1)

Una contadora entra con su correo y contraseña y trabaja en el back-office sin volver a identificarse mientras esté
activa. Si escribe mal la contraseña recibe un mensaje que no revela si el correo existe.

**Why this priority**: sin inicio de sesión real no hay despliegue a producción de ningún módulo.

**Independent Test**: crear un usuario con membresía en una empresa, iniciar sesión, consultar `/me` y la lista de
comprobantes, y luego intentar con una contraseña errada y con un correo inexistente.

**Acceptance Scenarios**:

1. **Dado** un usuario activo con membresía en una empresa, **Cuando** inicia sesión con credenciales correctas,
   **Entonces** entra al back-office de esa empresa y `/me` devuelve su usuario, la empresa y sus permisos.
2. **Dado** una contraseña errada, **Cuando** intenta entrar, **Entonces** ve «Correo o contraseña incorrectos» y no
   se crea sesión.
3. **Dado** un correo que no existe, **Cuando** intenta entrar, **Entonces** ve exactamente el mismo mensaje y la
   respuesta tarda lo mismo que con un correo existente.

---

### User Story 2 - Sesión segura que se renueva sola y se puede cerrar (Priority: P1)

La sesión se mantiene con una credencial de acceso de vida corta que se renueva sin que el usuario lo note. Si alguien
roba y reutiliza una credencial de renovación ya usada, todas las credenciales de esa sesión quedan revocadas. El
usuario puede cerrar sesión, ver sus sesiones abiertas por dispositivo y cerrar cualquiera.

**Why this priority**: es lo que hace segura la sesión de un sistema con información fiscal y contable.

**Independent Test**: iniciar sesión, dejar vencer la credencial de acceso, renovarla, reutilizar la credencial de
renovación anterior y comprobar la revocación.

**Acceptance Scenarios**:

1. **Dado** una credencial de acceso vencida y una de renovación vigente, **Cuando** el back-office la renueva,
   **Entonces** recibe credenciales nuevas y la de renovación anterior queda inválida.
2. **Dado** una credencial de renovación ya rotada, **Cuando** alguien la presenta, **Entonces** la API responde
   `401 UNAUTHENTICATED`, revoca toda la sesión y registra el evento de seguridad.
3. **Dado** 30 minutos sin actividad, **Cuando** el usuario intenta una acción, **Entonces** ve «Tu sesión venció»
   y debe volver a escribir su contraseña; su borrador local se conserva.
4. **Dado** dos sesiones abiertas (oficina y portátil), **Cuando** el usuario cierra la del portátil desde «Mis
   sesiones», **Entonces** la siguiente petición del portátil responde `401` y la de la oficina sigue activa.

---

### User Story 3 - Elegir empresa (Priority: P2)

Un contador externo que lleva varias empresas elige con cuál trabajar al entrar y puede cambiar de empresa sin cerrar
sesión. Nunca ve datos de una empresa a la que no pertenece.

**Why this priority**: el producto es multiempresa (S-01) y la maqueta `3q` lo muestra; el aislamiento por empresa
depende de que la sesión fije una sola empresa a la vez.

**Independent Test**: usuario con membresía en dos empresas: entrar, elegir A, cambiar a B y comprobar que cada
consulta solo devuelve datos de la empresa activa.

**Acceptance Scenarios**:

1. **Dado** un usuario con membresía en dos empresas, **Cuando** inicia sesión, **Entonces** ve la lista de sus
   empresas y entra a la que elija; con una sola empresa entra directo.
2. **Dado** que trabaja en la empresa A, **Cuando** cambia a la B, **Entonces** recibe credenciales de la empresa B y
   las de A dejan de servir para B.
3. **Dado** un usuario sin membresía en la empresa C, **Cuando** pide cambiar a C, **Entonces** recibe `403
   FORBIDDEN` y la sesión sigue en la empresa actual.

---

### User Story 4 - Recuperar la contraseña (Priority: P2)

Quien olvidó su contraseña pide un enlace, lo recibe por correo y define una nueva. El enlace sirve una sola vez y
vence pronto. Al cambiar la contraseña se cierran todas sus sesiones.

**Why this priority**: sin recuperación autónoma cada olvido es un caso de soporte; la maqueta tiene el enlace
«¿Olvidaste tu contraseña?» sin pantalla (auditoría m4).

**Independent Test**: pedir el enlace, usarlo, intentar reutilizarlo y usar uno vencido.

**Acceptance Scenarios**:

1. **Dado** un correo registrado, **Cuando** pide recuperar, **Entonces** ve «Si el correo está registrado,
   recibirás un enlace» y se envía un enlace válido por 30 minutos.
2. **Dado** un correo no registrado, **Cuando** pide recuperar, **Entonces** ve el mismo mensaje y no se envía nada.
3. **Dado** un enlace ya usado o vencido, **Cuando** se abre, **Entonces** ve «Este enlace ya no es válido» y la
   opción de pedir otro.
4. **Dado** una contraseña nueva válida, **Cuando** la guarda, **Entonces** todas sus sesiones abiertas se cierran y
   debe entrar de nuevo.

---

### User Story 5 - Protección contra adivinación de contraseñas (Priority: P2)

Tras varios intentos fallidos la cuenta se bloquea temporalmente y el intento queda registrado; el usuario sabe
cuánto debe esperar o cómo recuperar el acceso.

**Why this priority**: mitiga el ataque más común contra un inicio de sesión público.

**Independent Test**: cinco contraseñas erradas seguidas y un sexto intento con la contraseña correcta.

**Acceptance Scenarios**:

1. **Dado** cuatro intentos fallidos, **Cuando** falla el quinto, **Entonces** la cuenta queda bloqueada 15 minutos
   y el mensaje dice «Por seguridad bloqueamos el acceso durante 15 minutos. Puedes recuperar tu contraseña».
2. **Dado** una cuenta bloqueada, **Cuando** se escribe la contraseña correcta, **Entonces** tampoco entra hasta que
   termine el bloqueo o se recupere la contraseña.
3. **Dado** un bloqueo, **Entonces** la bitácora de seguridad registra correo, dirección de origen, hora y número de
   intentos.

---

### User Story 6 - Publicar a producción con identidad real (Priority: P3)

El equipo puede desplegar la API y el back-office a producción porque ya no dependen del adaptador provisional.

**Why this priority**: cierra la dependencia que bloquea todo despliegue, pero solo tiene valor cuando US1–US5 existen.

**Independent Test**: arrancar la API con `NODE_ENV=production` y compilar el back-office para producción.

**Acceptance Scenarios**:

1. **Dado** la configuración de producción, **Cuando** arranca la API, **Entonces** el adaptador provisional no
   existe y solo se aceptan credenciales emitidas por esta spec.
2. **Dado** el back-office, **Cuando** se compila para producción, **Entonces** la compilación termina y no contiene
   tokens ni mecanismos de desarrollo.

### Edge Cases

- **Dos pestañas** renuevan la credencial a la vez: solo una rotación gana; la otra reintenta con la credencial nueva
  sin provocar la revocación por reutilización (ventana de gracia de pocos segundos para la credencial recién rotada).
- **Usuario desactivado** (spec 017) con sesión abierta: su siguiente petición responde `401` y no puede renovar.
- **Membresía retirada** de una empresa con sesión abierta en ella: la siguiente renovación falla con `403` y el
  back-office ofrece elegir otra empresa.
- **Reloj del navegador desfasado**: la validez se decide solo con la hora del servidor.
- **Contraseña igual a la anterior** o presente en la lista de contraseñas comunes: se rechaza con la causa.
- **Enlace de recuperación pedido varias veces**: solo el último es válido.
- **Ataque distribuido** a muchas cuentas desde una dirección: se limita por dirección además de por cuenta.
- **Correo con mayúsculas o espacios**: se normaliza (minúsculas, sin espacios al inicio o al final) antes de comparar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST autenticar a un usuario por correo y contraseña y emitir una credencial de acceso de vida corta (15 minutos) y una credencial de renovación ligada a una sesión y a un dispositivo *(P-IV, ADR-0002)*.
- **FR-002**: Las contraseñas MUST almacenarse solo como resumen con un algoritmo resistente a fuerza bruta y sal por usuario; nunca en claro ni en registros *(P-IV)*.
- **FR-003**: Una contraseña nueva MUST tener al menos 12 caracteres, no estar en la lista de contraseñas comunes ni ser igual a la anterior; no se exigen reglas de composición *(P-IV)*.
- **FR-004**: Ante credenciales inválidas el sistema MUST responder con el mismo mensaje y un tiempo de respuesta equivalente exista o no el correo *(P-IV)*.
- **FR-005**: La credencial de renovación MUST ser de un solo uso: cada renovación emite una nueva e invalida la anterior; presentar una ya rotada (fuera de una ventana de gracia de 10 segundos) MUST revocar toda la sesión y registrar un evento de seguridad *(P-IV)*.
- **FR-006**: La credencial de renovación MUST guardarse en el navegador fuera del alcance de los scripts de la página y viajar solo al servidor de SIFCA *(P-IV)*.
- **FR-007**: Una sesión MUST terminar tras 30 minutos sin actividad y, en todo caso, a las 12 horas de iniciada; al vencer, el back-office MUST pedir la contraseña sin perder la pantalla ni los borradores locales *(P-IV)*.
- **FR-008**: El usuario MUST poder cerrar su sesión actual, ver sus sesiones abiertas (dispositivo, navegador, dirección aproximada, último uso) y cerrar cualquiera; un cierre MUST surtir efecto en la siguiente petición de ese dispositivo *(P-IV)*.
- **FR-009**: Cada sesión MUST trabajar en **una sola empresa a la vez**; la credencial de acceso MUST llevar la empresa activa, que alimenta el aislamiento por empresa de la base de datos *(P-IV, ADR-0002)*.
- **FR-010**: Un usuario con membresía en varias empresas MUST poder elegir la empresa al entrar y cambiarla sin cerrar sesión; pedir una empresa sin membresía MUST responder `403 FORBIDDEN` *(P-IV, ADR-0002)*.
- **FR-011**: Tras 5 intentos fallidos consecutivos en una cuenta, el sistema MUST bloquearla 15 minutos; además MUST limitar los intentos por dirección de origen *(P-IV)*.
- **FR-012**: La recuperación de contraseña MUST enviar un enlace de un solo uso válido 30 minutos, responder igual exista o no el correo, invalidar los enlaces anteriores y cerrar todas las sesiones al cambiar la contraseña *(P-IV)*.
- **FR-013**: Los eventos de seguridad (inicio y cierre de sesión, fallos, bloqueos, reutilización detectada, recuperación, cambio de empresa) MUST quedar en la bitácora de auditoría con usuario, empresa, dirección, dispositivo e instante, sin contraseñas ni credenciales *(P-I)*.
- **FR-014**: `/me` MUST devolver el contexto de sesión del contrato de la spec 016 con `authMode = password`, de modo que el back-office no cambie su forma de leer usuario, empresa y permisos *(P-V, ADR-0009)*.
- **FR-015**: El adaptador provisional de autenticación de la spec 001 MUST eliminarse del código de producción; solo puede existir como utilidad de pruebas automatizadas *(P-IV)*.
- **FR-016**: El back-office MUST poder compilarse para producción con este modo de autenticación (levanta el bloqueo de la spec 016, FR-021) *(P-IX)*.
- **FR-017**: Todas las entradas de autenticación MUST validarse con los esquemas de contratos compartidos y responder errores `problem+json` con códigos estables (`UNAUTHENTICATED`, `ACCOUNT_LOCKED`, `INVALID_RESET_LINK`, `WEAK_PASSWORD`, `FORBIDDEN`) *(P-V, ADR-0009)*.
- **FR-018**: Las pantallas de ingreso, elección de empresa, recuperación, nueva contraseña y «Mis sesiones» MUST cumplir los estados globales y la accesibilidad del cascarón de la spec 016 *(ADR-0001)*.

### Key Entities *(include if feature involves data)*

- **Cuenta de usuario**: identidad global por correo (único en todo el sistema), resumen de contraseña, estado
  (activa, desactivada), contador de intentos fallidos y bloqueo hasta.
- **Membresía**: relación usuario–empresa con estado; de ella salen los roles y permisos (spec 017). Un usuario puede
  tener varias.
- **Sesión**: usuario, empresa activa, dispositivo y navegador, dirección aproximada, inicio, último uso, fin.
- **Credencial de renovación**: pertenece a una sesión, de un solo uso, con su sucesora y estado (vigente, rotada,
  revocada).
- **Enlace de recuperación**: usuario, resumen del secreto, vencimiento, usado o no.
- **Evento de seguridad**: tipo, usuario o correo intentado, empresa, dirección, dispositivo, instante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con una sola empresa entra al back-office en menos de 10 segundos desde que abre la página.
- **SC-002**: El 100 % de los intentos de reutilizar una credencial de renovación rotada (fuera de la ventana de
  gracia) termina con la sesión revocada y un evento de seguridad registrado.
- **SC-003**: La diferencia de tiempo de respuesta entre un correo existente y uno inexistente es menor de 50 ms en el
  percentil 95 (no se puede enumerar usuarios por tiempo).
- **SC-004**: Cero contraseñas o credenciales en registros, bitácora o respuestas (verificado con búsqueda automatizada
  en los registros de las pruebas).
- **SC-005**: El 100 % de los escenarios de la spec 001 pasa usando credenciales reales en lugar del adaptador
  provisional.
- **SC-006**: Un usuario recupera su contraseña de forma autónoma en menos de 3 minutos.

## Assumptions

- **Identidad global y membresías:** un mismo correo es una sola cuenta que puede pertenecer a varias empresas. Esto
  ajusta el modelo preliminar (`APP_USER.email` era único por empresa); el plan lo reflejará en el modelo de datos.
- **Alta de usuarios:** la invitación y administración de usuarios, roles y permisos es la spec 017. Para probar esta
  spec existe una utilidad de pruebas que crea cuentas y membresías.
- **Segundo factor (MFA):** opcional y administrado en la spec 017; esta spec deja el punto de extensión en el flujo
  de ingreso pero no lo implementa.
- **Envío de correo:** a través de un puerto de notificaciones; en desarrollo los correos van a un buzón local
  consultable; el proveedor real se elige en el plan.
- **Inicio de sesión único (SSO) con proveedores externos:** fuera de alcance.
- **Cuentas de la vitrina pública y de la app móvil:** la app móvil (025) reutiliza estas credenciales; la vitrina
  (024) no tiene cuentas de cliente.
- **Valores:** 15 min de acceso, 30 min de inactividad, 12 h de vida máxima, 5 intentos y 15 min de bloqueo,
  30 min para el enlace; se dejan como parámetros de plataforma (no por empresa).

## Trazabilidad de reglas

Esta especificación se rige por los principios de la [constitución](../../constitution.md) I (bitácora inmutable de
eventos de seguridad), IV (aislamiento por empresa), V y IX, y por los ADR-0002 y ADR-0009, más el invariante INV-11
del [modelo de datos](../../01-arquitectura/02-modelo-de-datos-preliminar.md). La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/autenticacion.feature`](acceptance/autenticacion.feature). Maquetas: `2a/2b`, `2k/2o`, `6u/6v`, `5q`, `3q`
([`maquetas/`](../../04-diseno-ux/maquetas/README.md)). Depende de la spec 016 (cascarón y `/me`).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | La política de contraseñas, la rotación y el bloqueo son reglas de dominio sin framework; los algoritmos criptográficos son adaptadores |
| G-05 | El envío de correo de recuperación sale por *outbox* o cola, fuera de la transacción |
| G-06 | Los eventos de seguridad son de solo inserción |
| G-07 | Membresías y sesiones con `tenant_id` donde aplica y prueba de aislamiento; la cuenta global no expone datos de empresas |
| G-08 | Entradas validadas con esquemas de `packages/contracts` |
| G-11 | Escenarios `[012-01]…[012-12]` etiquetados |
| G-12 | Sin acoplamiento con proveedores externos de identidad |
