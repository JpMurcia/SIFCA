import { Given } from '@cucumber/cucumber';
import { seedFiscalYear, seedTestChart } from '../../../fixtures/plan-de-cuentas-de-prueba.js';
import type { SifcaWorld } from '../../support/world.js';

Given('una empresa con el plan de cuentas cargado y el período de octubre de 2026 abierto', async function (this: SifcaWorld) {
  await this.db.withTenant(
    this.tenantId,
    async (c) => {
      await seedTestChart(c, this.tenantId);
      await seedFiscalYear(c, this.tenantId, 2026);
    },
    this.db.owner,
  );
});
