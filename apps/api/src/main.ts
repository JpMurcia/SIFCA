import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './platform/config/env.schema.js';
import { setupSwaggerUi } from './platform/http/openapi.js';
import { ProblemDetailsFilter } from './platform/http/problem-details.filter.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
  if (env.NODE_ENV !== 'production') setupSwaggerUi(app);
  await app.listen(env.PORT);
}
void bootstrap();
