/**
 * Reglas de arquitectura D-1…D-7 (docs/01-arquitectura/01-vision-general-y-modulos.md §4)
 * + gates G-01, G-02, G-03 de la constitución.
 */
const MOD = '^src/modules/([^/]+)';
module.exports = {
  forbidden: [
    {
      name: 'D-1a-domain-sin-frameworks',
      comment: 'G-01: el dominio no importa NestJS, Prisma, Zod, pg, decimal.js directo, fs, http ni red.',
      severity: 'error',
      from: { path: `${MOD}/domain` },
      to: {
        path: '(^|/)node_modules/(@nestjs|@prisma|prisma|zod|pg|decimal\\.js|rxjs|reflect-metadata)(/|$)',
        // core de Node
      },
    },
    {
      name: 'D-1b-domain-sin-core-node-io',
      severity: 'error',
      from: { path: `${MOD}/domain` },
      to: { dependencyTypes: ['core'], path: '^(node:)?(fs|http|https|net|child_process|dgram|dns|tls|worker_threads)$' },
    },
    {
      name: 'D-1c-domain-hacia-adentro',
      comment: 'El dominio no importa application, infrastructure, presentation ni platform.',
      severity: 'error',
      from: { path: `${MOD}/domain` },
      to: { path: ['^src/modules/[^/]+/(application|infrastructure|presentation)', '^src/platform'] },
    },
    {
      name: 'D-2-application-sin-adaptadores',
      comment: 'La aplicación depende del dominio y de sus propios puertos; nunca de Prisma, Nest ni de infraestructura.',
      severity: 'error',
      from: { path: `${MOD}/application` },
      to: {
        path: [
          '(^|/)node_modules/(@nestjs|@prisma|prisma|pg|rxjs)(/|$)',
          '^src/modules/[^/]+/(infrastructure|presentation)',
          '^src/platform',
        ],
      },
    },
    {
      name: 'D-3-infra-presentation-no-se-importan',
      severity: 'error',
      from: { path: `${MOD}/infrastructure` },
      to: { path: `${MOD}/presentation` },
    },
    {
      name: 'D-3b-presentation-no-importa-infra',
      severity: 'error',
      from: { path: `${MOD}/presentation` },
      to: { path: `${MOD}/infrastructure` },
    },
    {
      name: 'D-4-prisma-solo-en-persistencia',
      comment: 'G-03: los tipos de Prisma no salen de infrastructure/persistence ni de platform/persistence.',
      severity: 'error',
      from: { pathNot: ['^src/modules/[^/]+/infrastructure/persistence', '^src/platform/persistence', '^prisma/', '^test/'] },
      to: { path: ['(^|/)node_modules/(@prisma|prisma)(/|$)', '^src/generated/prisma'] },
    },
    {
      name: 'D-5-modulos-solo-por-index',
      comment: 'Un módulo solo importa de otro a través de su index.ts.',
      severity: 'error',
      from: { path: `${MOD}/`, pathNot: '^src/modules/([^/]+)/.*\\.module\\.ts$' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'kernel-puro',
      comment: 'shared-kernel no importa módulos, plataforma ni frameworks.',
      severity: 'error',
      from: { path: '^src/shared-kernel' },
      to: { path: ['^src/modules', '^src/platform', '(^|/)node_modules/(@nestjs|@prisma|prisma|zod|pg|rxjs)(/|$)'] },
    },
    {
      name: 'D-7-adaptadores-solo-en-composition-root',
      comment: 'Solo los *.module.ts y main.ts pueden instanciar adaptadores concretos (presentation/application no importan platform).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(application|presentation)' },
      to: { path: '^src/platform' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules|^src/generated' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'], extensions: ['.ts', '.js'] },
    moduleSystems: ['es6', 'cjs'],
    // `.js` en los imports TypeScript NodeNext resuelve al .ts
    detectJSDocImports: false,
  },
};
