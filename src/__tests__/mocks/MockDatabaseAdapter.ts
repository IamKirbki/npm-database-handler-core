import type IDatabaseAdapter from '@core/interfaces/IDatabaseAdapter.js';
import type IStatementAdapter from '@core/interfaces/IStatementAdapter.js';
import type ISchemaBuilder from '@core/interfaces/ISchemaBuilder.js';
import { MockStatementAdapter } from './MockStatementAdapter';
import { MockSchemaBuilder } from './MockSchemaBuilder';
import type { QueryValues } from '@core/types/index.js';

/**
 * Mock database adapter for testing purposes
 * Tracks all operations and allows assertions on them
 */
export class MockDatabaseAdapter implements IDatabaseAdapter {
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
        const mockResults = this.mockResults.get(query) || [];
        return new MockStatementAdapter(query, mockResults);
    }

    exec(query: string): void {
        this.operations.push({ type: 'exec', query });
    }

    run(query: string, values: QueryValues[]): void {
        this.operations.push({ type: 'run', query, values });
    }

    get(query: string, values: QueryValues[]): any {
        const result = this.mockRowResults.get(query);
        this.operations.push({ type: 'get', query, values, result });
        return result;
    }

    all(query: string, values: QueryValues[]): any[] {
        const results = this.mockResults.get(query) || [];
        this.operations.push({ type: 'all', query, values, result: results });
        return results;
    }

    close(): void {
        this.isOpen = false;
        this.operations.push({ type: 'close' });
    }

    transaction<T>(fn: () => T): T {
        this.operations.push({ type: 'transaction_start' });
        try {
            const result = fn();
            this.operations.push({ type: 'transaction_commit' });
            return result;
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
