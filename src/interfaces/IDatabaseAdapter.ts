import { TableColumnInfo } from '@core/types/table.js';
import IStatementAdapter from './IStatementAdapter.js';

export default interface IDatabaseAdapter {
    connect(params: unknown): Promise<void>;
    prepare(query: string): Promise<IStatementAdapter>;
    exec(query: string): Promise<void>;
    transaction(fn: (items: any[]) => void): Promise<Function>;
    tableColumnInformation(tableName: string): Promise<TableColumnInfo[]>;
    tableExists(tableName: string): Promise<boolean>;
    close(): Promise<void>;
}