import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * OpenAPI generado por NestJS a partir de las rutas reales. El contrato de diseño
 * (docs/specs/NNN-…/contracts/accounting.v1.openapi.yaml) se compara contra este documento en CI (rutas y métodos), y los cuerpos
 * se validan contra el contrato en las pruebas de contrato.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('SIFCA API').setVersion('0.1.0').addBearerAuth().build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwaggerUi(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
}
