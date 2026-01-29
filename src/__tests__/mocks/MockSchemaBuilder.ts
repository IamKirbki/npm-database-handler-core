import type ISchemaBuilder from '../../interfaces/ISchemaBuilder';
import type SchemaTableBuilder from '../../abstract/SchemaTableBuilder';

/**
 * Mock schema builder for testing schema operations
 */
export class MockSchemaBuilder implements ISchemaBuilder {
    public operations: Array<{
        type: string;
        tableName?: string;
        callback?: any;
    }> = [];

    async createTable(tableName: string, callback: (table: SchemaTableBuilder) => void): Promise<void> {
        this.operations.push({ type: 'createTable', tableName, callback });
    }

    async dropTable(tableName: string): Promise<void> {
        this.operations.push({ type: 'dropTable', tableName });
    }

    async alterTable(tableName: string, callback: (table: SchemaTableBuilder) => void): Promise<void> {
        this.operations.push({ type: 'alterTable', tableName, callback });
    }

    async hasTable(tableName: string): Promise<boolean> {
        this.operations.push({ type: 'hasTable', tableName });
        return false;
    }

    /**
     * Clear all recorded operations
     */
    public clear(): void {
        this.operations = [];
    }

    /**
     * Check if a specific operation was performed
     */
    public async hasOperation(type: string, tableName?: string): Promise<boolean> {
        return this.operations.some(op => 
            op.type === type && (!tableName || op.tableName === tableName)
        );
    }
}
