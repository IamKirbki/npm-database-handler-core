import DatabaseHandlerError from "../DatabaseHandlerError.js";

export default class AdapterNotFoundError extends DatabaseHandlerError {
    constructor(adapterName: string) {
        super(`Adapter not found: ${adapterName}`, { code: 'ADAPTER_NOT_FOUND' });
    }
}
