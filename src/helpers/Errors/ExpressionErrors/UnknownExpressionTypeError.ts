import { DatabaseHandlerError } from '../DatabaseHandlerError.js';

export class UnknownExpressionTypeError extends DatabaseHandlerError {
  constructor(type: string) {
    super(`No builder registered for expression type: ${type}`, {
      code: 'UNKNOWN_EXPRESSION_TYPE',
    });
  }
}
