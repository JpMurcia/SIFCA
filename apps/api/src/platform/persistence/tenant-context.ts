import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../generated/prisma/client.js';

export type TxClient = Prisma.TransactionClient;

interface Store {
  readonly tx: TxClient;
}

const als = new AsyncLocalStorage<Store>();

/**
 * Contexto asíncrono de la transacción en curso. Los repositorios obtienen el cliente transaccional de aquí
 * (research §9): así el dominio y la aplicación no conocen ningún tipo de infraestructura.
 */
export const TransactionContext = {
  run<T>(tx: TxClient, fn: () => Promise<T>): Promise<T> {
    return als.run({ tx }, fn);
  },
  active(): boolean {
    return als.getStore() !== undefined;
  },
  client(): TxClient {
    const store = als.getStore();
    if (!store) throw new Error('No hay una transacción activa: ejecuta la operación dentro de UnitOfWork.run()');
    return store.tx;
  },
};
