import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class InvalidExpressionParametersError extends DatabaseHandlerError {
    constructor(message: string) {
        super(`Invalid expression parameters: ${message}`, { code: 'INVALID_EXPRESSION_PARAMETERS' });
    }
}
