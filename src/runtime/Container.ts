import IDatabaseAdapter from "@core/interfaces/IDatabaseAdapter.js";

class Container {
    private static _instance: Container;
    private _adapters: Map<string, IDatabaseAdapter> = new Map();
    private _defaultAdapter?: IDatabaseAdapter;

    private constructor() { }

    public static getInstance(): Container {
        if (!Container._instance) {
            Container._instance = new Container();
        }
        return Container._instance;
    }

    public registerAdapter(name: string, adapter: IDatabaseAdapter, isDefault = false): void {
        this._adapters.set(name, adapter);
        if (isDefault || !this._defaultAdapter) {
            if(this._defaultAdapter) {
                // eslint-disable-next-line no-undef
                console.warn(`Setting default adapter to '${name}'`);
            }

            this._defaultAdapter = adapter;
        }
    }

    public getAdapter(name?: string): IDatabaseAdapter {
        if (name) {
            const adapter = this._adapters.get(name);
            if (!adapter) throw new Error(`Adapter '${name}' not found`);
            return adapter;
        }
        if (!this._defaultAdapter) throw new Error("No default adapter set");
        return this._defaultAdapter;
    }
}

export default Container;