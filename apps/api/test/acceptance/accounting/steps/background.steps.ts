import { Given } from '@cucumber/cucumber';
import type { SifcaWorld } from '../../support/world.js';

Given('una empresa con el plan de cuentas cargado y el período de octubre de 2026 abierto', async function (this: SifcaWorld) {
  await this.seedCompany();
});
