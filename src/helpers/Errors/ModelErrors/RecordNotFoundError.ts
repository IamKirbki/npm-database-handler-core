import DatabaseHandlerError from "../DatabaseHandlerError.js";
import { QueryValues } from "../../../types/query.js";

export default class RecordNotFoundError extends DatabaseHandlerError {
    constructor(identifier: QueryValues | undefined, table: string) {
        super(`No record found in table '${table}' matching identifier '${identifier}'`, { code: 'RECORD_NOT_FOUND' });
    }
}
