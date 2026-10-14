// Ejecuta los .feature de las specs tal cual (no se copian). Un escenario sin step o pendiente FALLA (strict).
export default {
  paths: ['../../docs/specs/001-*/acceptance/*.feature'],
  import: ['test/acceptance/support/**/*.ts', 'test/acceptance/**/steps/*.ts'],
  loader: [],
  format: ['progress'],
  strict: true,
  worldParameters: {},
};
