import { DatabaseHandlerError } from "../DatabaseHandlerError.js";

export class UnknownTableError extends DatabaseHandlerError {
    constructor(tableName: string, message?: string) {
        super(`Unknown table: ${tableName}${message ? `. ${message}` : ''}`, { code: 'UNKNOWN_TABLE' });
    }
}
