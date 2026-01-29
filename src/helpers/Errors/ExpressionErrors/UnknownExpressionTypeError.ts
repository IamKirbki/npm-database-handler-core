export class UnknownExpressionTypeError extends Error {
    constructor(type: string) {
        super(`No builder registered for expression type: ${type}`);
        this.name = "UnknownExpressionTypeError";
    }
}
