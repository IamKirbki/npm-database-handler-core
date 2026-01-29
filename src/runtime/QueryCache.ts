import { TableColumnInfo } from "@core/types/table.js";

export default class QueryCache {
    private static _instance?: QueryCache;
    private cachedExistingTables: string[] = [];
    private cachedTableColumnInformation: Map<string, TableColumnInfo[]> = new Map();

    public static getInstance(): QueryCache {
        if (!this._instance) {
            this._instance = new QueryCache();
        }

        return this._instance;
    }

    public doesTableExist(table: string): boolean {
        return this.cachedExistingTables.includes(table)
    }

    public addExistingTable(table: string): void {
        if (!this.doesTableExist(table)) {
            this.cachedExistingTables.push(table);
        }
    }

    public getTableColumnInformation(tableName: string): TableColumnInfo[] | undefined {
        return this.cachedTableColumnInformation.get(tableName);
    }

    public setTableColumnInformation(tableName: string, tableColumnInformation: TableColumnInfo[]) {
        return this.cachedTableColumnInformation.set(tableName, tableColumnInformation);
    }
}