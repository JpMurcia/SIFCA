export interface IdGenerator {
  /** UUID v7 (ordenable por tiempo). */
  next(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');
