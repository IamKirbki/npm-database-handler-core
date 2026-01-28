export default class UnknownTableError extends Error {
    constructor(tableName: string) {
        super(`Unknown table: ${tableName}`);
        this.name = "UnknownTableError";
    }
}