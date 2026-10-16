# Contrato de interfaz: catálogo de errores tipificados

Fuente del texto: [`03-catalogo-de-pantallas.md`](../../../04-diseno-ux/03-catalogo-de-pantallas.md) A.0 y la maqueta
`5q/5r`. Este archivo es el contrato que implementa `apps/admin/src/platform/errors/catalog.ts` y que verifican las
pruebas de componentes (SC-001) y el escenario [016-04].

Reglas generales:
- Un error responde **qué pasó, por qué y qué hacer**; el `code` y el `requestId` van en un detalle copiable, nunca
  como texto principal.
- Si el servidor envía `detail`, se muestra debajo del texto del catálogo, salvo en `INTERNAL_ERROR`.
- Un `code` desconocido o un cuerpo no `problem+json` se presenta como `INTERNAL_ERROR` (sin el cuerpo crudo).

| `code` | HTTP | Ubicación | Texto principal | Acción ofrecida |
|---|---|---|---|---|
| `ENTRY_NOT_BALANCED` | 422 | `banner` sobre la grilla + contador de diferencia | «El comprobante no cuadra: débitos {D} ≠ créditos {C}. Diferencia: {Δ}.» | Ninguna (corregir líneas) |
| `VALIDATION_FAILED` | 422 | `field` por cada `errors[].field` + resumen arriba | `errors[].message` | Enlace a cada campo; foco en el primero |
| `PERIOD_CLOSED` | 409 | `field` Fecha contable | «El período {AAAA-MM} está cerrado. Cambia la fecha contable o pide que lo reabran.» | Enlace a Períodos |
| `PERIOD_NOT_FOUND` | 422 | `field` Fecha contable | «No existe un período contable para esa fecha. Crea el año fiscal en Períodos.» | «Ir a Períodos» |
| `ALREADY_REVERSED` | 409 | `dialog` de reversión | «Este comprobante ya fue reversado por {tipo-número}.» | «Ver {tipo-número}» |
| `PERIOD_CLOSE_BLOCKED` | 409 | `dialog` de cierre | Lista de causas (`errors[]`) | Enlace por causa |
| `FORBIDDEN` | 403 | `toast` (acción) · `page` (ruta) | «No tienes permiso para esta acción ({permiso}).» | «Solicitar permiso» |
| `NOT_FOUND` | 404 | `page` | «No encontramos ese registro.» | Volver a la lista |
| `CONFLICT` | 409 | `dialog` | «Este registro cambió en otra sesión.» + `detail` | «Recargar» (los cambios locales se conservan como copia) |
| `IDEMPOTENCY_CONFLICT` | 422 | `toast` | «Este envío ya se había realizado con otros datos. Recarga la página.» | «Recargar» |
| `UNAUTHENTICATED` | 401 | `dialog` de sesión vencida | «Tu sesión venció.» | «Continuar» (reintenta una vez) |
| `INTERNAL_ERROR` | 500 | `page` (carga) · `toast` (acción) | «Ocurrió un error inesperado. Código de seguimiento: {requestId}.» | «Copiar código», «Reintentar» |
| `ENTRY_IMMUTABLE` | 405 | — | **No debe verse nunca**: la interfaz no ofrece editar ni eliminar | — |

Estados que no vienen de un `code`:

| Estado | Detección | Ubicación | Texto |
|---|---|---|---|
| Sin conexión | `offline` del navegador o fallo de red | `banner` fijo bajo la barra superior | «Sin conexión a internet. Puedes seguir digitando; enviaremos al reconectar.» + «Reintentar ahora» |
| Cambios sin guardar | navegación o cierre con formulario sucio | `dialog` | «¿Salir sin guardar?» · «Seguir editando» · «Descartar» |
| Ruta inexistente | sin coincidencia en el enrutador | `page` | «No encontramos esa página.» · «Ir al inicio» |
| Éxito | mutación correcta | `toast` | Verbo exacto + documento («Contabilizado como AJ-5») |
