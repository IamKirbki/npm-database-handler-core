export default class ConnectionFailedError extends Error {
    constructor(details: string) {
        super(`Connection failed: ${details}`);
        this.name = "ConnectionFailedError";
    }
}