import { After, AfterAll, Before, BeforeAll } from '@cucumber/cucumber';
import { bootstrapPostgres } from '../../integration/support/postgres-harness.js';
import type { SifcaWorld } from './world.js';

let stop: (() => Promise<void>) | undefined;

BeforeAll({ timeout: 180_000 }, async () => {
  stop = await bootstrapPostgres();
});
AfterAll({ timeout: 60_000 }, async () => {
  await stop?.();
});
Before({ timeout: 60_000 }, async function (this: SifcaWorld) {
  await this.init();
});
After({ timeout: 60_000 }, async function (this: SifcaWorld) {
  await this.dispose();
});
