export default class QueryCache {
    private static _instance?: QueryCache;
    private existingTables: string[] = [];

    public static getInstance(): QueryCache {
        if(!this._instance) {
            this._instance = new QueryCache();
        }

        return this._instance;
    }

    public doesTableExist(table: string): boolean {
        return this.existingTables.includes(table)
    }

    public addExistingTable(table: string): void {
        if(!this.doesTableExist(table)) {
            this.existingTables.push(table);
        }
    }
}