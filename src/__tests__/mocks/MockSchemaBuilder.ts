import type { ISchemaBuilder } from '../../interfaces/ISchemaBuilder';
import type { SchemaTableBuilder } from '../../abstract/SchemaTableBuilder';

/**
 * Mock schema builder for testing schema operations
 */
export class MockSchemaBuilder implements ISchemaBuilder {
    public operations: Array<{
        type: string;
        tableName?: string;
        callback?: any;
    }> = [];

    createTable(tableName: string, callback: (table: SchemaTableBuilder) => void): string {
        this.operations.push({ type: 'createTable', tableName, callback });
        return `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY)`;
    }

    dropTable(tableName: string): string {
        this.operations.push({ type: 'dropTable', tableName });
        return `DROP TABLE ${tableName}`;
    }

    alterTable(tableName: string, callback: (table: SchemaTableBuilder) => void): string {
        this.operations.push({ type: 'alterTable', tableName, callback });
        return `ALTER TABLE ${tableName}`;
    }

    hasTable(tableName: string): boolean {
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
    public hasOperation(type: string, tableName?: string): boolean {
        return this.operations.some(op => 
            op.type === type && (!tableName || op.tableName === tableName)
        );
    }
}
