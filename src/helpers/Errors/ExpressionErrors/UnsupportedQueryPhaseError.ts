export default class UnsupportedQueryPhaseError extends Error {
    constructor(phase?: string) {
        super(`The query evaluation phase "${phase}" is not supported by this expression.`);
        this.name = "UnsupportedQueryPhaseError";
    }
}