import { z } from 'zod';

/** Importe en COP: no negativo, hasta 2 decimales, como cadena (R-CON-009). */
export const MoneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Importe inválido: cadena decimal con hasta 2 decimales')
  .meta({ description: 'Importe en COP, no negativo, hasta 2 decimales, como cadena.', examples: ['1190000.00'] });

/** Importe con signo (saldos). */
export const SignedMoneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Importe inválido')
  .meta({ description: 'Importe con signo (saldos); cadena decimal.' });

export type MoneyString = z.infer<typeof MoneySchema>;
