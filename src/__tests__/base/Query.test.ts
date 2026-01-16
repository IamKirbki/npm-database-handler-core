import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Query from '@core/base/Query';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import { setupTestEnvironment, teardownTestEnvironment, createMockRow } from '../utils/testHelpers';

describe('Query', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        mockAdapter = setupTestEnvironment();
        mockAdapter.setTableExists('users', true);
    });

    afterEach(() => {
        teardownTestEnvironment();
    });

    describe('constructor', () => {
        it('should create a query instance with table name', () => {
            const query = new Query({ tableName: 'users' });
            expect(query).toBeDefined();
            expect(query.TableName).toBe('users');
        });

        it('should create a query instance with SQL query', () => {
            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users WHERE id = ?'
            });
            expect(query).toBeDefined();
        });

        it('should create a query instance with parameters', () => {
            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users WHERE id = :id',
                parameters: [{ column: 'id', operator: '=', value: 1 }]
            });
            expect(query.Parameters).toBeDefined();
        });
    });

    describe('Run', () => {
        it('should execute a non-SELECT query', async () => {
            const query = new Query({
                tableName: 'users',
                query: 'INSERT INTO users (name) VALUES (:name)'
            });

            await query.Run();

            expect(mockAdapter.getOperationCount('prepare')).toBe(1);
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries[0]).toContain('INSERT INTO');
        });

        it('should throw error when no query is defined', async () => {
            const query = new Query({ tableName: 'users' });

            await expect(query.Run()).rejects.toThrow('No query defined to execute.');
        });

        it('should execute UPDATE query', async () => {
            const query = new Query({
                tableName: 'users',
                query: 'UPDATE users SET name = :name WHERE id = :id'
            });

            await query.Run();

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries[0]).toContain('UPDATE');
        });

        it('should execute DELETE query', async () => {
            const query = new Query({
                tableName: 'users',
                query: 'DELETE FROM users WHERE id = :id'
            });

            await query.Run();

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries[0]).toContain('DELETE FROM');
        });
    });

    describe('All', () => {
        it('should fetch all records', async () => {
            const mockUsers = [
                createMockRow({ id: 1, name: 'Alice' }),
                createMockRow({ id: 2, name: 'Bob' }),
            ];

            mockAdapter.setMockResults('SELECT * FROM users', mockUsers);

            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users'
            });

            const results = await query.All();

            expect(results).toHaveLength(2);
            expect(mockAdapter.getOperationCount('prepare')).toBe(1);
        });

        it('should return empty array when no records found', async () => {
            mockAdapter.setMockResults('SELECT * FROM users', []);

            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users'
            });

            const results = await query.All();

            expect(results).toHaveLength(0);
        });

        it('should throw error when no query is defined', async () => {
            const query = new Query({ tableName: 'users' });

            await expect(query.All()).rejects.toThrow('No query defined to run');
        });
    });

    describe('Get', () => {
        it('should fetch a single record', async () => {
            const mockUser = createMockRow({ id: 1, name: 'Alice' });

            mockAdapter.setMockRow('SELECT * FROM users WHERE id = ?', mockUser);

            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users WHERE id = ?'
            });

            const result = await query.Get();

            expect(result).toBeDefined();
            expect(mockAdapter.getOperationCount('prepare')).toBe(1);
        });

        it('should return undefined when no record found', async () => {
            mockAdapter.setMockRow('SELECT * FROM users WHERE id = ?', undefined);

            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users WHERE id = ?'
            });

            const result = await query.Get();

            expect(result).toBeUndefined();
        });

        it('should throw error when no query is defined', async () => {
            const query = new Query({ tableName: 'users' });

            await expect(query.Get()).rejects.toThrow('No query defined to run');
        });
    });

    describe('Count', () => {
        it('should count records in table', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM users', { count: '10' });

            const query = new Query({
                tableName: 'users',
                query: 'SELECT COUNT(*) as count FROM users'
            });

            const count = await query.Count();

            expect(count).toBe(10);
        });

        it('should return 0 when no records found', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM users', { count: '0' });

            const query = new Query({
                tableName: 'users',
                query: 'SELECT COUNT(*) as count FROM users'
            });

            const count = await query.Count();

            expect(count).toBe(0);
        });

        it('should throw error when no query is defined', async () => {
            const query = new Query({ tableName: 'users' });

            await expect(query.Count()).rejects.toThrow('No query defined to run');
        });
    });

    describe('DoesTableExist', () => {
        it('should check if table exists', async () => {
            const query = new Query({ tableName: 'users' });

            const exists = await query.DoesTableExist();

            expect(typeof exists).toBe('boolean');
        });
    });

    describe('TableColumnInformation', () => {
        it('should get column information for table', async () => {
            const query = new Query({ tableName: 'users' });

            const columns = await query.TableColumnInformation('users');

            expect(Array.isArray(columns)).toBe(true);
        });
    });

    describe('ConvertParamsToObject', () => {
        it('should handle equality parameters', () => {
            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users',
                parameters: [{ column: 'id', operator: '=', value: 1 }]
            });

            expect(query.Parameters).toHaveProperty('id');
        });

        it('should handle comparison parameters', () => {
            const query = new Query({
                tableName: 'users',
                query: 'SELECT * FROM users',
                parameters: [{ column: 'age', operator: '>', value: 18 }]
            });

            expect(query.Parameters).toHaveProperty('age');
        });
    });
});
