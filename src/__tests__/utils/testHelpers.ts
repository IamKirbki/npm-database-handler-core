import Container from '../../runtime/Container';
import Repository from '../../runtime/Repository';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import type IDatabaseAdapter from '../../interfaces/IDatabaseAdapter';
import type { columnType } from '../../types';
import Model from '../../abstract/Model';

/**
 * Test utilities for setting up and tearing down test environments
 */

/**
 * Setup a test environment with a mock database adapter
 */
export function setupTestEnvironment(adapter?: IDatabaseAdapter): MockDatabaseAdapter {
    const mockAdapter = adapter instanceof MockDatabaseAdapter 
        ? adapter 
        : new MockDatabaseAdapter();
    
    // Reset singletons
    Container.resetInstance();
    Repository.clearInstances();
    
    // Register mock adapter
    Container.getInstance().register('database', mockAdapter);
    
    return mockAdapter;
}

/**
 * Cleanup test environment
 */
export function teardownTestEnvironment(): void {
    Container.resetInstance();
    Repository.clearInstances();
}

/**
 * Create a test model class with minimal configuration
 */
export function createTestModel<T extends columnType>(
    tableName: string,
    columns: T,
    primaryKey: keyof T = 'id' as keyof T
) {
    return class TestModel extends Model<T> {
        static tableName = tableName;
        static primaryKey = primaryKey as string;
        static columns = columns;

        protected get configuration() {
            return {
                tableName: TestModel.tableName,
                primaryKey: TestModel.primaryKey,
                columns: TestModel.columns,
            };
        }
    };
}

/**
 * Create mock row data for testing
 */
export function createMockRow<T extends Record<string, any>>(
    data: Partial<T>,
    defaults?: Partial<T>
): T {
    return { ...defaults, ...data } as T;
}

/**
 * Assert that a mock adapter executed a specific query
 */
export function assertQueryExecuted(
    adapter: MockDatabaseAdapter,
    queryPattern: string | RegExp
): boolean {
    const queries = adapter.operations.map(op => op.query).filter(Boolean);
    
    if (typeof queryPattern === 'string') {
        return queries.some(q => q?.includes(queryPattern));
    }
    
    return queries.some(q => q && queryPattern.test(q));
}

/**
 * Get all executed queries of a specific type
 */
export function getExecutedQueries(
    adapter: MockDatabaseAdapter,
    type?: 'prepare' | 'exec' | 'run' | 'get' | 'all'
): string[] {
    return adapter.operations
        .filter(op => !type || op.type === type)
        .map(op => op.query)
        .filter((q): q is string => q !== undefined);
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
