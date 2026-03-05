import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class RelationError extends DatabaseHandlerError {
    constructor(relation: string, message?: string) {
        super(`Error in relation '${relation}'${message ? `: ${message}` : ''}`, { code: 'RELATION_ERROR' });
    }
}
