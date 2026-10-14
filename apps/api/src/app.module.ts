import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AccountingModule } from './modules/accounting/index.js';
import { createRequestContextMiddleware } from './platform/http/request-context.js';
import { PlatformModule } from './platform/platform.module.js';

@Module({ imports: [PlatformModule, AccountingModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    const secret = process.env.JWT_DEV_SECRET;
    if (!secret) throw new Error('Falta JWT_DEV_SECRET');
    consumer.apply(createRequestContextMiddleware(secret)).forRoutes('*');
  }
}
