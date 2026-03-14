import { DatabaseHandlerError } from "../DatabaseHandlerError.js";

export class QueryExecutionError extends DatabaseHandlerError {
    constructor(query: string, cause?: unknown) {
        super(`Query failed to execute: ${query}`, { cause: cause, code: 'QUERY_EXECUTION_ERROR' });
    }
}
