# Feature Specification: Fundaciones del back-office web (cascarón, estados globales y cliente de contratos)

**Feature Branch**: `016-fundaciones-frontend`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "SPEC-016 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 0): aplicación web del
back-office con los tokens de diseño de las maquetas (temas Claro y Slate, densidades Compacta/Normal/Cómoda), el
cascarón de navegación a 1440 y 1024 px con barra superior, chip de período y paleta Ctrl+K, los componentes de estado
global (esqueleto, vacío, error tipificado, sin conexión, sesión vencida, cambios sin guardar, éxito y 403), un
cliente de la API que traduce cada código de error al texto del catálogo A.0, formatos es-CO y guardas de ruta por
permiso. Maquetas: 1a–1f, 5q/5r, 7aa–7aj, 4a."

## Contexto

Ninguna pantalla de SIFCA puede construirse sin una base común: hoy existe solo la API (spec 001). Esta spec entrega
el **marco** en el que cada spec posterior monta sus pantallas, de modo que todas compartan navegación, formatos,
manejo de errores y accesibilidad (principio de diseño D-8: «misma lógica en todas las pantallas»). No contiene
pantallas de negocio; la única pantalla con datos reales que se usa para demostrarla es la **lista de comprobantes**
de la spec 001, que ya tiene API.

Fuentes: [sistema de diseño](../../04-diseno-ux/04-sistema-de-diseno.md),
[navegación](../../04-diseno-ux/02-navegacion-y-arquitectura-de-informacion.md),
[catálogo de pantallas](../../04-diseno-ux/03-catalogo-de-pantallas.md) (A.0 errores y Parte D estados globales) y
la [auditoría de mockups](../../roadmap-specs.md) §1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Moverse por el back-office con un cascarón coherente (Priority: P1)

Un contador abre SIFCA y encuentra siempre el mismo marco: menú lateral por módulos, barra superior con la empresa
(nombre y NIT), el **chip del período** de trabajo («Oct 2026 · Abierto»), alertas y su menú de usuario. A 1440 px
el menú está expandido; a 1024 px se reduce a íconos; por debajo pasa a un cajón. Puede elegir tema Claro u Slate y
densidad Compacta, Normal o Cómoda, y su elección se conserva.

**Why this priority**: es el andamiaje de todas las pantallas; sin él cada spec reinventaría navegación y estilos.

**Independent Test**: con la API de la spec 001 levantada, abrir la aplicación a 1440, 1024 y 800 px y recorrer
el menú; cambiar tema y densidad, recargar y comprobar que se conservan.

**Acceptance Scenarios**:

1. **Dado** una ventana de 1440 px, **Cuando** el usuario entra, **Entonces** ve el menú expandido con los módulos
   del mapa del sitio, la empresa con su NIT y el chip «Oct 2026 · Abierto» obtenido del período real.
2. **Dado** una ventana de 1024 px, **Cuando** el usuario entra, **Entonces** el menú muestra solo íconos con
   nombre accesible y tooltip, y el contenido usa el ancho restante.
3. **Dado** que el usuario eligió tema Slate y densidad Compacta, **Cuando** recarga, **Entonces** la aplicación
   abre con ese tema y esa densidad (filas de 28 px y texto de 13 px).
4. **Dado** que el período de trabajo está cerrado, **Cuando** se muestra el chip, **Entonces** dice «Sep 2026 ·
   Cerrado» en estilo de advertencia y al pulsarlo lleva a Períodos.

---

### User Story 2 - Entender cualquier error sin ayuda técnica (Priority: P1)

Cuando la API responde con un error, el usuario ve un mensaje en español que dice **qué pasó, por qué y qué hacer**,
en el lugar que define el catálogo A.0 (junto al campo, en un banner, en un diálogo o en un toast), y puede copiar
el código de seguimiento para soporte. Nunca ve trazas, JSON ni códigos HTTP sueltos.

**Why this priority**: los errores tipificados son la forma en que las reglas contables (inmutabilidad, períodos,
partida doble) llegan al usuario; si se muestran mal, el usuario no puede corregir.

**Independent Test**: con respuestas de la API simuladas para cada código del catálogo A.0, verificar texto y
ubicación de cada uno; con la API real, provocar `PERIOD_NOT_FOUND` y `FORBIDDEN`.

**Acceptance Scenarios**:

1. **Dado** una respuesta `VALIDATION_FAILED` con errores en `lines[2].accountCode` y `description`, **Cuando** se
   muestra, **Entonces** cada mensaje aparece junto a su campo, hay un resumen arriba con enlaces y el foco va al
   primer campo con error.
2. **Dado** una respuesta `INTERNAL_ERROR` con identificador de solicitud, **Cuando** se muestra, **Entonces** el
   usuario ve «Ocurrió un error inesperado» con el código copiable y un botón «Reintentar».
3. **Dado** una respuesta `CONFLICT` al guardar, **Cuando** se muestra, **Entonces** aparece el diálogo «Este
   registro cambió en otra sesión» con «Recargar» y los cambios locales se conservan como copia.
4. **Dado** un código de error que el catálogo no conoce, **Cuando** llega, **Entonces** se muestra el `detail`
   del servidor con el código copiable, sin romper la pantalla.

---

### User Story 3 - Ver solo lo que se puede hacer (Priority: P1)

Un usuario sin un permiso no ve la entrada de menú ni la acción correspondiente. Si llega por un enlace directo, ve
una página «No tienes permiso» que explica qué permiso falta, quién puede concedérselo y le permite **solicitar
acceso**. Si la API rechaza una acción con 403, ve un toast con la misma explicación.

**Why this priority**: es el comportamiento que exige el catálogo (Parte D) y protege contra acciones fallidas.

**Independent Test**: con un usuario de desarrollo con solo `accounting.report.read`, comprobar que no aparecen
«Nuevo comprobante», «Cerrar mes» ni «Reabrir», y que abrir `/contabilidad/comprobantes/nuevo` muestra la página 403.

**Acceptance Scenarios**:

1. **Dado** un usuario sin `accounting.entry.post`, **Cuando** abre el menú y la lista de comprobantes,
   **Entonces** no ve «Nuevo comprobante» en el menú, en la lista ni en la paleta.
2. **Dado** el mismo usuario, **Cuando** abre por enlace la ruta del editor, **Entonces** ve la página 403 con el
   permiso faltante y el botón «Solicitar permiso».
3. **Dado** una acción visible que la API rechaza con `FORBIDDEN`, **Cuando** llega la respuesta, **Entonces** se
   muestra el toast «No tienes permiso para esta acción (permiso)» y la acción queda deshabilitada con esa razón.

---

### User Story 4 - Estados de carga, vacío, sin conexión y sesión vencida (Priority: P2)

Mientras carga una lista, el usuario ve filas esqueleto con la forma de la tabla (no un bloqueo de página). Una lista
vacía explica por qué está vacía y ofrece la acción principal. Si se pierde la conexión, aparece un banner fijo y
las acciones que requieren servidor se deshabilitan; al reconectar se reintenta. Si la sesión vence, un diálogo pide
la contraseña sin perder la pantalla actual. Al intentar salir con cambios sin guardar, se pide confirmación.

**Why this priority**: son los cinco estados que la auditoría exige en todas las pantallas; se resuelven una vez.

**Independent Test**: con la lista de comprobantes, simular latencia, lista vacía, desconexión y token vencido.

**Acceptance Scenarios**:

1. **Dado** una lista que tarda en responder, **Cuando** se espera, **Entonces** se ven filas esqueleto con las
   columnas de la tabla y el resto de la página sigue usable.
2. **Dado** una consulta sin resultados con filtros activos, **Cuando** se muestra, **Entonces** dice «Aún no hay
   comprobantes en este rango» y ofrece «Limpiar filtros» y, si tiene permiso, «Nuevo comprobante».
3. **Dado** que se pierde la conexión, **Cuando** el usuario sigue en la pantalla, **Entonces** ve «Sin conexión a
   internet» con «Reintentar ahora» y los botones que envían datos quedan deshabilitados con explicación.
4. **Dado** una sesión vencida, **Cuando** el usuario hace una acción, **Entonces** aparece el diálogo «Tu sesión
   venció» y, al volver a entrar, la acción se reintenta una sola vez sin duplicarse.
5. **Dado** un formulario con cambios, **Cuando** el usuario navega a otra ruta o cierra la pestaña, **Entonces** se
   pregunta «¿Salir sin guardar?» con «Seguir editando» y «Descartar».

---

### User Story 5 - Paleta de comandos y teclado (Priority: P2)

Con `Ctrl/Cmd + K` el usuario abre una paleta que busca pantallas y acciones (sin tildes), con prefijos `>`
(acciones), `#` (documentos por número), `@` (terceros, cuando existan) y `/` (ayuda); muestra recientes y el atajo de
cada acción, y solo ofrece lo que el usuario puede hacer. Todo el cascarón se opera sin ratón.

**Why this priority**: es un requisito transversal desde F2 (CP-01…CP-07) que condiciona el registro de rutas y
acciones de todas las specs.

**Independent Test**: abrir la paleta, escribir «balance» y «#AJ-1», y navegar solo con teclado.

**Acceptance Scenarios**:

1. **Dado** la paleta abierta, **Cuando** escribe «balance», **Entonces** aparece «Balance de prueba» y Enter
   navega a esa pantalla.
2. **Dado** la paleta abierta, **Cuando** escribe «#AJ-1», **Entonces** ofrece abrir la lista de comprobantes
   filtrada por AJ-1 si existe (el detalle del comprobante llega con la interfaz de la spec 001).
3. **Dado** cualquier pantalla del cascarón, **Cuando** el usuario navega con Tab, **Entonces** el foco es visible
   en todo control, sigue un orden lógico y no queda atrapado fuera de los diálogos.

---

### User Story 6 - Cifras y fechas en formato colombiano sin errores de redondeo (Priority: P2)

Los importes se muestran `$ 1.190.000,00` alineados a la derecha con cifras tabulares, las fechas `14/10/2026` y los
instantes en hora de Colombia. La entrada acepta `1190000,5` y fechas tecleadas como `14102026`. Los cálculos de
totales en pantalla nunca usan aritmética de coma flotante.

**Why this priority**: es obligatorio en el sistema de diseño (§7) y en la constitución (dinero exacto).

**Independent Test**: componentes de importe y fecha con una batería de entradas y salidas esperadas.

**Acceptance Scenarios**:

1. **Dado** el importe `"1190000.5"` de la API, **Cuando** se muestra, **Entonces** se lee `$ 1.190.000,50`.
2. **Dado** la suma de `"0.10"`, `"0.20"` y `"0.30"`, **Cuando** se totaliza en pantalla, **Entonces** el total es
   exactamente `$ 0,60`.
3. **Dado** el instante `2026-02-01T04:30:00Z`, **Cuando** se muestra, **Entonces** se lee `31/01/2026 23:30`.

### Edge Cases

- **Código de error desconocido** o respuesta no `problem+json` (p. ej. un proxy devuelve HTML 502): se muestra el
  error genérico con el código de seguimiento si existe, sin mostrar el cuerpo crudo.
- **Período de trabajo inexistente** (año fiscal sin crear): el chip dice «Sin período» y enlaza a Períodos.
- **Dos pestañas abiertas** y la sesión se cierra en una: la otra muestra el diálogo de sesión vencida en su
  siguiente acción, no un error genérico.
- **Reintento tras sesión vencida o red caída** de una operación que crea datos: se reenvía con la misma clave de
  idempotencia, de modo que nunca se duplica.
- **Ruta inexistente**: página «No encontramos esa página» con enlace al inicio (distinta de la 403).
- **Texto ampliado al 200 %** o ancho de 768 px: el cascarón sigue usable, sin cortes ni desbordes horizontales de la
  página (las tablas pueden desplazarse dentro de su contenedor).
- **`prefers-reduced-motion`**: sin animaciones de transición en menú, diálogos ni esqueletos.
- **Permisos que cambian durante la sesión**: al renovarse la sesión, el menú y las acciones se recalculan sin recargar.

## Requirements *(mandatory)*

### Functional Requirements

**Cascarón y preferencias**

- **FR-001**: El back-office MUST mostrar un cascarón común con menú lateral por módulos según el mapa del sitio, barra superior con logo, nombre y NIT de la empresa, botón «Buscar o ejecutar… Ctrl K», chip del período, alertas y menú de usuario *(ADR-0001)*.
- **FR-002**: El menú MUST estar expandido desde 1280 px, reducido a íconos entre 1024 y 1279 px y en cajón por debajo de 1024 px; cada ícono MUST tener nombre accesible y tooltip *(ADR-0001)*.
- **FR-003**: El chip del período MUST reflejar el estado real del período de la fecha de trabajo (abierto, cerrado, sin período) consultando los períodos contables, y MUST enlazar a Períodos *(R-CON-004, R-CON-011)*.
- **FR-004**: El usuario MUST poder elegir tema (Claro, Slate) y densidad (Compacta 28 px/13 px, Normal 36 px/14 px, Cómoda 44 px/16 px), con Compacta por defecto en Contabilidad; la elección MUST conservarse entre sesiones en el mismo equipo *(ADR-0001)*.
- **FR-005**: Los colores, tipografías, espaciados y radios MUST provenir de un único conjunto de tokens con los valores del sistema de diseño y de las maquetas `1a/1b`; ninguna pantalla MUST definir colores propios *(ADR-0001)*.

**Errores, estados y permisos**

- **FR-006**: Toda respuesta de error de la API MUST traducirse a un error tipificado por su `code` y mostrarse con el texto y en el lugar indicados en el catálogo A.0 (campo, banner, diálogo, toast o página) *(P-V, ADR-0009)*.
- **FR-007**: Los errores de validación con lista de campos MUST marcar cada campo indicado por su ruta (incluidas rutas de líneas como `lines[2].amount`), mostrar un resumen con enlaces y llevar el foco al primero *(P-V)*.
- **FR-008**: Los errores inesperados MUST mostrar un código de seguimiento copiable y la opción de reintentar; un código desconocido MUST degradar al mensaje genérico sin exponer el cuerpo crudo *(P-V)*.
- **FR-009**: La interfaz MUST ofrecer componentes compartidos para cargando (filas esqueleto con la forma de la tabla), vacío (motivo + acción principal), sin conexión (banner fijo y acciones de envío deshabilitadas), sesión vencida (diálogo que reautentica sin abandonar la pantalla), cambios sin guardar (confirmación al salir), éxito (toast) y no encontrado (página) *(ADR-0001)*.
- **FR-010**: Cada ruta y cada acción MUST declarar el permiso que requiere; lo que el usuario no puede hacer MUST no mostrarse en menú, listas ni paleta, y el acceso directo a una ruta sin permiso MUST mostrar la página 403 con el permiso faltante y «Solicitar permiso» *(P-IV)*.
- **FR-011**: Un rechazo `FORBIDDEN` de la API MUST mostrarse como toast con el permiso indicado y deshabilitar la acción con su explicación *(P-IV)*.
- **FR-012**: Toda operación que crea datos MUST enviar una clave de idempotencia y reutilizarla en cualquier reintento (red caída o sesión renovada), de modo que un reintento nunca duplique *(P-III, ADR-0006)*.
- **FR-013**: Los documentos inmutables MUST presentarse sin controles de edición ni de borrado y con la explicación «Para corregir, usa Reversar»; el cascarón MUST proveer este modo de solo lectura como patrón *(R-CON-005, P-I)*.

**Contratos, formatos y navegación por teclado**

- **FR-014**: Los tipos de datos, rutas y errores que la interfaz usa MUST derivarse de los contratos compartidos del proyecto, sin definiciones paralelas escritas a mano *(P-V, ADR-0009)*.
- **FR-015**: Los importes MUST mostrarse en formato `es-CO` con 2 decimales, alineados a la derecha y con cifras tabulares; MUST viajar como cadenas decimales y MUST operarse en pantalla con aritmética decimal exacta, nunca de coma flotante *(R-CON-009, P-VI, ADR-0007)*.
- **FR-016**: Las fechas MUST mostrarse `dd/mm/aaaa` y aceptar entrada abreviada (`14102026`, `14/10/26`); los instantes MUST mostrarse en hora de Colombia (UTC−5) *(R-CON-014)*.
- **FR-017**: `Ctrl/Cmd + K` MUST abrir una paleta que busque pantallas y acciones registradas, tolerante a tildes, con prefijos `>`, `#`, `@` y `/`, sección de recientes, atajo visible por acción y solo resultados permitidos al usuario; las specs posteriores MUST poder registrar sus pantallas, acciones y fuentes de búsqueda *(ADR-0001)*.
- **FR-018**: El cascarón y sus componentes MUST cumplir WCAG 2.1 AA: contraste, foco visible de 2 px, operación completa por teclado, diálogos con foco atrapado, anuncios en región viva para toasts y totales, idioma `es-CO`, texto ampliable al 200 % y respeto a `prefers-reduced-motion` *(ADR-0001)*.
- **FR-019**: Los atajos globales (`Ctrl/Cmd + K`, `G` + letra de módulo, `?` para ver atajos, `Esc`) MUST funcionar en todo el cascarón y mostrarse en la ayuda `?` *(ADR-0001)*.

**Demostración e integración**

- **FR-020**: La lista de comprobantes (`/contabilidad/comprobantes`) MUST construirse sobre el cascarón con datos reales de la API existente, como pantalla de referencia que ejercita esqueleto, vacío, error, filtros, paginación y permisos; sus filas MUST mostrar las etiquetas «Contabilizado», «Reversado por…» y «Reversión de…» y nunca «Editar» ni «Eliminar» *(R-CON-005, R-CON-010)*.
- **FR-021**: Mientras no exista la spec de autenticación (012), la aplicación MUST funcionar en desarrollo con el token provisional de la spec 001 y MUST negarse a construirse para producción en ese modo *(P-IV)*.
- **FR-022**: Cada componente compartido MUST tener un catálogo navegable de sus variantes y estados (en ambos temas y las tres densidades) que sirva de referencia a las specs posteriores *(P-VIII)*.
- **FR-023**: Mientras las pantallas de negocio que muestran errores de campo, de grilla y de diálogo no existan (llegan con la interfaz de la spec 001), el entorno de pruebas MUST ofrecer una **pantalla de demostración** con una grilla de líneas, un formulario con fecha contable y un envío de comprobante sobre la API real, excluida por completo de cualquier versión para producción; los escenarios de errores, cambios sin guardar e idempotencia se verifican sobre ella *(P-VIII)*.
- **FR-024**: En desarrollo y pruebas la fecha de trabajo MUST poder fijarse por configuración y, en pruebas, por solicitud, para que los escenarios que dependen del período sean reproducibles en cualquier fecha; en producción esta posibilidad MUST no existir *(R-CON-014, P-VIII)*.

### Key Entities *(include if feature involves data)*

- **Error tipificado**: código estable, estado HTTP, título, detalle, lista de errores de campo (ruta, mensaje,
  regla) y código de seguimiento; determina texto y ubicación en pantalla.
- **Permiso**: identificador `modulo.recurso.accion` que exigen una ruta, una acción de menú o un botón.
- **Registro de navegación**: pantallas y acciones que cada spec declara (ruta, nombre, ícono, módulo, permiso,
  atajo, palabras de búsqueda); alimenta menú, paleta y guardas.
- **Preferencias de interfaz**: tema y densidad del usuario en el equipo.
- **Contexto de trabajo**: empresa (nombre, NIT), usuario, permisos y período de la fecha de trabajo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los códigos del catálogo A.0 tiene una prueba que verifica su texto y su ubicación.
- **SC-002**: Cero violaciones automáticas de accesibilidad nivel AA en el cascarón, la paleta, la página 403 y la
  lista de comprobantes, en ambos temas y en las tres densidades.
- **SC-003**: Un usuario encuentra y abre cualquier pantalla registrada desde la paleta en menos de 5 segundos y con
  no más de 3 pulsaciones después de escribir la búsqueda.
- **SC-004**: La primera pantalla del back-office es usable en menos de 2,5 segundos en un equipo de oficina con
  conexión de 10 Mbps, y una navegación entre pantallas ya cargadas responde en menos de 300 ms.
- **SC-005**: Un reintento tras pérdida de red o sesión vencida nunca produce un registro duplicado (0 duplicados en
  la batería de pruebas de reintento).
- **SC-006**: Una spec posterior agrega una pantalla nueva al menú, a la paleta y a las guardas declarando una sola
  entrada de registro, sin modificar el cascarón.
- **SC-007**: El 100 % de las sumas de importes en pantalla de la batería de pruebas coincide al centavo con el
  cálculo decimal exacto.

## Assumptions

- **Alcance:** solo el back-office web. La vitrina pública (SPEC-024) y la app móvil (SPEC-025) tendrán su propio
  marco; comparten los tokens de diseño pero no el cascarón.
- **Sin autenticación real todavía:** el inicio de sesión, la renovación de sesión y la recuperación de contraseña
  llegan con la spec 012. Aquí el diálogo de sesión vencida y el manejo de `UNAUTHENTICATED` se construyen y prueban
  con el token provisional de desarrollo y con respuestas simuladas.
- **Datos de empresa:** mientras no exista la configuración por empresa (013), el nombre y el NIT de la barra
  superior vienen de la configuración del entorno de desarrollo.
- **Fecha de trabajo:** es la fecha actual en hora de Colombia; en desarrollo y pruebas puede fijarse por configuración (FR-024). Que el usuario elija otra fecha de trabajo queda para 013.
- **«Solicitar permiso»:** en esta spec registra la intención y muestra la confirmación; el envío real al
  administrador llega con la spec 017.
- **Preferencias:** se guardan en el equipo del usuario; sincronizarlas entre equipos queda para 017.
- **Alertas:** la campana se muestra con contador en cero; cada módulo aporta sus alertas en su spec.
- **Tablero de inicio** (`4a`): se entrega vacío con el mensaje de bienvenida; las tarjetas las aportan los módulos.
- **Pantallas aún no construidas:** las entradas de menú de specs futuras se muestran deshabilitadas con la etiqueta
  «Próximamente»; las rutas registradas sin pantalla todavía (p. ej. Períodos, Nuevo comprobante) muestran la página
  «Próximamente».
- **Navegadores:** las dos últimas versiones de Chrome, Edge, Firefox y Safari de escritorio.
- **Bibliotecas de componentes:** la elección (provisional en `03-evaluacion-de-librerias.md`) se confirma en
  `/speckit-plan` con el *spike* S-UI; esta spec no depende de ella.

## Trazabilidad de reglas

Esta especificación se rige por los principios de la [constitución](../../constitution.md) I, III, IV, V, VI y
VIII y por los ADR-0001, ADR-0006, ADR-0007 y ADR-0009. Reglas contables que la interfaz hace visibles:
R-CON-004 y R-CON-011 (períodos), R-CON-005 (inmutabilidad), R-CON-009 (decimales), R-CON-010 (libros
reproducibles) y R-CON-014 (zona horaria). La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/fundaciones-frontend.feature`](acceptance/fundaciones-frontend.feature). Diseño:
[`04-sistema-de-diseno.md`](../../04-diseno-ux/04-sistema-de-diseno.md) §2–§9,
[`02-navegacion-…`](../../04-diseno-ux/02-navegacion-y-arquitectura-de-informacion.md) §3–§6 y maquetas `1a–1f`,
`5q/5r`, `7aa–7aj`, `4a`.

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | La interfaz es un adaptador de presentación: no contiene reglas de negocio; las valida el servidor y las muestra |
| G-05 | Sin efectos externos nuevos; el cliente solo llama a la API |
| G-06 | No existen controles de edición ni borrado para documentos inmutables (FR-013, FR-020) |
| G-07 | No crea tablas; respeta el aislamiento: la empresa y los permisos salen del token |
| G-08 | Tipos y errores derivados de los contratos compartidos (FR-014) |
| G-09 | Importes como cadenas y aritmética decimal exacta en pantalla (FR-015) |
| G-11 | Escenarios Gherkin `[016-01]…[016-12]` etiquetados; los que necesitan pantallas de la spec 001 corren sobre la pantalla de demostración de pruebas (FR-023) |
| G-12 | Sin acoplamiento con sistemas externos |
