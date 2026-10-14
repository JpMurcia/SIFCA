# Diseño de experiencia (UX/UI) de SIFCA — insumos para la maqueta

> **Para qué sirve esta carpeta.** Reúne, con rigor y trazabilidad, todo lo que una herramienta de diseño
> (p. ej. **Claude Design**) o un diseñador necesita para producir una **maqueta navegable** del back-office y de la
> vitrina de SIFCA: quién usa el sistema, qué pantallas existen, qué datos y acciones tiene cada una, qué errores
> puede mostrar y con qué reglas del negocio se corresponde.
>
> **Estado:** propuesta de diseño. **No hay interfaz construida**: el código existente es el backend de contabilidad
> (spec 001). Todo lo que aquí se dice de pantallas es *especificación para maquetar*, no descripción de algo ya hecho.

## Cómo usarla con Claude Design

1. Abre una sesión de Claude Design y pega el contenido de **[`01-brief-claude-design.md`](01-brief-claude-design.md)**
   (es autosuficiente: producto, usuarios, principios, alcance de la primera maqueta y entregables esperados).
2. Adjunta, por orden de prioridad, los documentos de apoyo:
   [`02-navegacion-y-arquitectura-de-informacion.md`](02-navegacion-y-arquitectura-de-informacion.md) (menú, rutas,
   atajos), [`03-catalogo-de-pantallas.md`](03-catalogo-de-pantallas.md) (campos, estados, errores, datos de ejemplo)
   y [`04-sistema-de-diseno.md`](04-sistema-de-diseno.md) (tokens, componentes, accesibilidad).
   Para Integraciones, migración y configuración adjunta también
   [`06-integraciones-migracion-y-configuracion.md`](06-integraciones-migracion-y-configuracion.md).
3. Pide la maqueta **por tandas** (ver §«Orden de trabajo» del brief): primero el cascarón + Contabilidad (la única
   parte con backend real), después Ventas/Cartera/Inventario, al final vitrina y móvil.
4. Para validar la maqueta contra el sistema real, cada pantalla indica los *endpoints* y los códigos de error del
   contrato [`accounting.v1.openapi.yaml`](../specs/001-contabilidad-comprobantes-inmutables/contracts/accounting.v1.openapi.yaml).

## Contenido

| Documento | Qué contiene |
|---|---|
| [`01-brief-claude-design.md`](01-brief-claude-design.md) | **El prompt/brief maestro** para generar la maqueta |
| [`02-navegacion-y-arquitectura-de-informacion.md`](02-navegacion-y-arquitectura-de-informacion.md) | Mapa del sitio, menú, rutas, paleta de comandos, atajos de teclado, permisos por sección |
| [`03-catalogo-de-pantallas.md`](03-catalogo-de-pantallas.md) | Cada pantalla: propósito, usuario, datos, acciones, estados vacíos/error, reglas y datos de ejemplo |
| [`04-sistema-de-diseno.md`](04-sistema-de-diseno.md) | Principios, color (con contrastes calculados), tipografía, densidad, componentes contables, accesibilidad, formato `es-CO` |
| [`06-integraciones-migracion-y-configuracion.md`](06-integraciones-migracion-y-configuracion.md) | **Integraciones, migración de datos (Alegra y archivos) y configuración por empresa**: principios, API de Alegra con su certeza, reglas de migración, pantallas IN.1–IN.10, catálogo de configuración, lo no configurable y el radar de decisiones |
| [`05-referencias-y-benchmark.md`](05-referencias-y-benchmark.md) | Qué se investigó (REA, SamitSQL, Alegra), qué está verificado y qué no, y la **hoja de captura** para completar la navegación de SamitSQL |

## Qué es verificado y qué es propuesta (léelo antes de maquetar)

| Tipo de contenido | Estado |
|---|---|
| Módulos, flujos, estados, reglas, mensajes de error y permisos de **Contabilidad** | ✅ implementados y probados (backend) |
| Pantallas de Ventas, Cartera, Compras, Inventario, Impuestos, Factura electrónica, Integraciones | Especificadas en las specs 002–011 (sin backend todavía): campos y estados salen de las specs y del modelo de datos |
| **Conectores, migración desde Alegra/archivos y configuración por empresa** | 💡 Propuesta para la fase F8 (specs 013–015 propuestas); la API de Alegra está documentada con su certeza (`06-…` §3.1) |
| Navegación, jerarquía del menú, atajos, densidad y estilo visual | **Propuesta de diseño** (decisión del equipo; se valida con usuarios) |
| Distribución y menús de **SamitSQL** y de otros programas contables | 🔶 **No verificados**: ver `05-…` (no se hizo ingeniería inversa; hay una hoja para completarla con capturas) |
