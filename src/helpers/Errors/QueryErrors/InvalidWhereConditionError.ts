import DatabaseHandlerError from '../DatabaseHandlerError.js';

export default class InvalidWhereConditionError extends DatabaseHandlerError {
  constructor(message: string = 'Invalid WHERE condition encountered.') {
    super(message, { code: 'INVALID_WHERE_CONDITION_ERROR' });
  }
}
