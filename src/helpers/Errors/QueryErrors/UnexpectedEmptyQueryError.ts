import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class UnexpectedEmptyQueryError extends DatabaseHandlerError {
    constructor() {
        super(`The query is unexpectedly empty. Please ensure that the query is properly constructed and contains valid clauses.`, { code: 'UNEXPECTED_EMPTY_QUERY' });
    }
}
