import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_MIGRATION_URL ?? 'postgresql://sifca_owner:sifca_owner_dev@127.0.0.1:54329/sifca_dev' },
});
