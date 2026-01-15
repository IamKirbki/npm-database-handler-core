import type IStatementAdapter from '@core/interfaces/IStatementAdapter.js';
import type { QueryValues } from '../../types';

/**
 * Mock statement adapter for testing prepared statements
 */
export class MockStatementAdapter implements IStatementAdapter {
    public executions: Array<{
        values?: QueryValues[];
        result?: any;
    }> = [];

    constructor(
        public readonly query: string,
        private mockResults: any[] = []
    ) {}

    async run(...values: QueryValues[]): Promise<void> {
        this.executions.push({ values });
    }

    async get(...values: QueryValues[]): Promise<any> {
        const result = this.mockResults[0];
        this.executions.push({ values, result });
        return result;
    }

    async all(...values: QueryValues[]): Promise<any[]> {
        this.executions.push({ values, result: this.mockResults });
        return this.mockResults;
    }

    /**
     * Set mock results for this statement
     */
    public setMockResults(results: any[]): void {
        this.mockResults = results;
    }

    /**
     * Get the number of times this statement was executed
     */
    public getExecutionCount(): number {
        return this.executions.length;
    }
}
