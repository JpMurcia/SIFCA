import { v7 as uuidv7 } from 'uuid';
import type { IdGenerator } from '../../shared-kernel/index.js';

export class SystemIdGenerator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
