export default class InvalidExpressionParametersError extends Error {
    constructor(message: string) {
        super(`Invalid expression parameters: ${message}`);
        this.name = "InvalidExpressionParametersError";
    }
}