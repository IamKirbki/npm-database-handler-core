import { DatabaseHandlerError } from '../DatabaseHandlerError.js';

export class ConnectionFailedError extends DatabaseHandlerError {
  constructor(details: string) {
    super(`Connection failed: ${details}`, { code: 'CONNECTION_FAILED' });
  }
}
