import { DatabaseHandlerError } from '../DatabaseHandlerError.js';

export class NoDefaultAdapterError extends DatabaseHandlerError {
  constructor() {
    super('No default adapter set', { code: 'NO_DEFAULT_ADAPTER' });
  }
}
