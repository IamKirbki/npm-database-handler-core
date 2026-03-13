import { DatabaseHandlerError } from "../DatabaseHandlerError.js";

export class InvalidOperationError extends DatabaseHandlerError {
    constructor(message: string) {
        super(message, { code: 'INVALID_OPERATION' });
    }
}
