import { Decimal as DecimalJs } from 'decimal.js';

/**
 * Decimal local: configuración aislada (no toca el estado global de la librería).
 * Redondeo mitad hacia arriba sobre el valor absoluto (R-CON-009.3): ROUND_HALF_UP de decimal.js
 * redondea «alejándose de cero» en el empate.
 */
export const Decimal = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_HALF_UP });
export type Decimal = InstanceType<typeof Decimal>;
