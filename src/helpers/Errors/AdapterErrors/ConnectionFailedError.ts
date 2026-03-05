import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class ConnectionFailedError extends DatabaseHandlerError {
    constructor(details: string) {
        super(`Connection failed: ${details}`, { code: 'CONNECTION_FAILED' });
    }
}
