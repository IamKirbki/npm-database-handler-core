export default class UnexpectedEmptyQueryError extends Error {
    constructor() {
        super(`The query is unexpectedly empty. Please ensure that the query is properly constructed and contains valid clauses.`);
        this.name = "UnexpectedEmptyQueryError";
    }
}