import type IDatabaseAdapter from '@core/interfaces/IDatabaseAdapter.js';
import type IStatementAdapter from '@core/interfaces/IStatementAdapter.js';
import type ISchemaBuilder from '@core/interfaces/ISchemaBuilder.js';
import { MockStatementAdapter } from './MockStatementAdapter';
import { MockSchemaBuilder } from './MockSchemaBuilder';
import type { QueryValues, TableColumnInfo } from '@core/types/index.js';

/**
 * Mock database adapter for testing purposes
 * Tracks all operations and allows assertions on them
 */
export class MockDatabaseAdapter implements IDatabaseAdapter {
    private mockTableColumns: Map<string, TableColumnInfo[]> = new Map();
    private existingTables: Set<string> = new Set();

    async connect(params: unknown): Promise<void> {
        this.operations.push({ type: 'connect', result: params });
        this.isOpen = true;
    }

    async tableColumnInformation(tableName: string): Promise<TableColumnInfo[]> {
        this.operations.push({ type: 'tableColumnInformation', query: tableName });
        return this.mockTableColumns.get(tableName) || [];
    }

    async tableExists(tableName: string): Promise<boolean> {
        const exists = this.existingTables.has(tableName);
        this.operations.push({ type: 'tableExists', query: tableName, result: exists });
        return exists;
    }

    /**
     * Set mock table columns for testing
     */
    public setMockTableColumns(tableName: string, columns: TableColumnInfo[]): void {
        this.mockTableColumns.set(tableName, columns);
    }

    /**
     * Set whether a table exists for testing
     */
    public setTableExists(tableName: string, exists: boolean): void {
        if (exists) {
            this.existingTables.add(tableName);
        } else {
            this.existingTables.delete(tableName);
        }
    }
    
    public operations: Array<{
        type: string;
        query?: string;
        values?: QueryValues[];
        result?: any;
    }> = [];

    private mockResults: Map<string, any[]> = new Map();
    private mockRowResults: Map<string, any> = new Map();
    public isOpen = true;

    /**
     * Set mock data to be returned for specific queries
     */
    public setMockResults(query: string, results: any[]): void {
        this.mockResults.set(query, results);
    }

    /**
     * Set mock single row result for specific queries
     */
    public setMockRow(query: string, result: any): void {
        this.mockRowResults.set(query, result);
    }

    /**
     * Clear all recorded operations and mock data
     */
    public clear(): void {
        this.operations = [];
        this.mockResults.clear();
        this.mockRowResults.clear();
    }

    async prepare(query: string): Promise<IStatementAdapter> {
        this.operations.push({ type: 'prepare', query });
        
        // Try exact match first
        let mockResults = this.mockResults.get(query);
        let mockRow = this.mockRowResults.get(query);
        
        // If no exact match, try to find a partial match based on table name
        if (!mockResults && !mockRow) {
            // Extract table name from query
            const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
            const tableName = tableMatch ? tableMatch[1] : null;
            
            if (tableName) {
                // Look for any mock that references this table
                for (const [key, value] of this.mockResults.entries()) {
                    if (key.includes(tableName) && (query.includes('SELECT') || key.includes('SELECT'))) {
                        mockResults = value;
                        break;
                    }
                }
                for (const [key, value] of this.mockRowResults.entries()) {
                    if (key.includes(tableName) && (query.includes('SELECT') || key.includes('SELECT'))) {
                        mockRow = value;
                        break;
                    }
                }
            }
        }
        
        return new MockStatementAdapter(query, mockResults || [], mockRow);
    }

    async exec(query: string): Promise<void> {
        this.operations.push({ type: 'exec', query });
    }

    async run(query: string, values: QueryValues[]): Promise<void> {
        this.operations.push({ type: 'run', query, values });
    }

    async get(query: string, values: QueryValues[]): Promise<any> {
        const result = this.mockRowResults.get(query);
        this.operations.push({ type: 'get', query, values, result });
        return result;
    }

    async all(query: string, values: QueryValues[]): Promise<any[]> {
        const results = this.mockResults.get(query) || [];
        this.operations.push({ type: 'all', query, values, result: results });
        return results;
    }

    async close(): Promise<void> {
        this.isOpen = false;
        this.operations.push({ type: 'close' });
    }

    async transaction<T>(fn: (items: any[]) => void): Promise<T> {
        this.operations.push({ type: 'transaction_start' });
        try {
            const result = await fn(['transaction_item']);
            this.operations.push({ type: 'transaction_commit' });
            return result as T;
        } catch (error) {
            this.operations.push({ type: 'transaction_rollback' });
            throw error;
        }
    }

    getSchemaBuilder(): ISchemaBuilder {
        return new MockSchemaBuilder();
    }

    /**
     * Helper to check if a specific query was executed
     */
    public hasExecuted(query: string): boolean {
        return this.operations.some(op => op.query === query);
    }

    /**
     * Helper to get count of specific operation types
     */
    public getOperationCount(type: string): number {
        return this.operations.filter(op => op.type === type).length;
    }

    /**
     * Helper to get all queries of a specific type
     */
    public getQueriesByType(type: string): string[] {
        return this.operations
            .filter(op => op.type === type)
            .map(op => op.query)
            .filter((q): q is string => q !== undefined);
    }
}
