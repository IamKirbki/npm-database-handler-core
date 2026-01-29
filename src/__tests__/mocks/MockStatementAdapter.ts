import type IStatementAdapter from '@core/interfaces/IStatementAdapter.js';
import type { QueryValues } from '@core/index.js';

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
        private mockResults: any[] = [],
        private mockRow?: any
    ) {}

    async run(parameters?: QueryValues[]): Promise<unknown> {
        this.executions.push({ values: parameters ? parameters : [] });
        return undefined;
    }

    async get(parameters?: QueryValues[]): Promise<any> {
        const result = this.mockRow !== undefined ? this.mockRow : this.mockResults[0];
        this.executions.push({ values: parameters ? parameters : [], result });
        return result;
    }

    async all(parameters?: QueryValues[]): Promise<any[]> {
        this.executions.push({ values: parameters ? parameters : [], result: this.mockResults });
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
