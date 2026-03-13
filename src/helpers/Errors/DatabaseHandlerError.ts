export class DatabaseHandlerError extends Error {
    public cause?: unknown;
    public code?: string;

    constructor(message: string, options?: { cause?: unknown, code?: string }) {
        super(message);
        this.name = this.constructor.name;
        this.cause = options?.cause;
        this.code = options?.code;
        
        // Ensure the prototype is correctly set for extending Error in TypeScript
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
