import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class UnsupportedQueryPhaseError extends DatabaseHandlerError {
    constructor(phase?: string) {
        super(`The query evaluation phase "${phase}" is not supported by this expression.`, { code: 'UNSUPPORTED_QUERY_PHASE' });
    }
}
