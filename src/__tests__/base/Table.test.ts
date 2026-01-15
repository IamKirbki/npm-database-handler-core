import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Table from '@core/base/Table';
import Container from '@core/runtime/Container';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import { setupTestEnvironment, teardownTestEnvironment, createMockRow } from '../utils/testHelpers';

describe('Table', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        mockAdapter = setupTestEnvironment();
    });

    afterEach(() => {
        teardownTestEnvironment();
    });

    describe('constructor', () => {
        it('should create a table instance with a name', () => {
            const table = new Table('users');
            expect(table).toBeDefined();
        });

        it('should create a table instance with custom adapter', () => {
            // Register a custom adapter first
            Container.getInstance().registerAdapter('customAdapter', mockAdapter);
            const table = new Table('users', 'customAdapter');
            expect(table).toBeDefined();
        });
    });

    describe('Records', () => {
        it('should fetch all records from the table', async () => {
            const mockUsers = [
                createMockRow({ id: 1, name: 'Alice', email: 'alice@example.com' }),
                createMockRow({ id: 2, name: 'Bob', email: 'bob@example.com' }),
            ];

            mockAdapter.setMockResults('SELECT * FROM "users"', mockUsers);

            const table = new Table('users');
            const records = await table.Records();

            expect(records).toHaveLength(2);
            expect(mockAdapter.getOperationCount('prepare')).toBeGreaterThan(0);
        });

        it('should fetch records with WHERE condition', async () => {
            const mockUser = createMockRow({ id: 1, name: 'Alice', email: 'alice@example.com' });
            
            mockAdapter.setMockResults('SELECT * FROM "users" WHERE "id" = ?', [mockUser]);

            const table = new Table('users');
            const records = await table.Records({
                where: { id: 1 }
            });

            expect(records).toBeDefined();
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('WHERE'))).toBe(true);
        });

        it('should fetch records with ORDER BY', async () => {
            const mockUsers = [
                createMockRow({ id: 1, name: 'Alice' }),
                createMockRow({ id: 2, name: 'Bob' }),
            ];

            mockAdapter.setMockResults('SELECT * FROM "users" ORDER BY name ASC', mockUsers);

            const table = new Table('users');
            const records = await table.Records({
                orderBy: 'name ASC'
            });

            expect(records).toBeDefined();
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('ORDER BY'))).toBe(true);
        });

        it('should fetch records with LIMIT and OFFSET', async () => {
            const mockUsers = [createMockRow({ id: 2, name: 'Bob' })];

            mockAdapter.setMockResults('SELECT * FROM "users" LIMIT 1 OFFSET 1', mockUsers);

            const table = new Table('users');
            const records = await table.Records({
                limit: 1,
                offset: 1
            });

            expect(records).toBeDefined();
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('LIMIT') && q.includes('OFFSET'))).toBe(true);
        });
    });

    describe('Record', () => {
        it('should fetch a single record by WHERE condition', async () => {
            const mockUser = createMockRow({ id: 1, name: 'Alice', email: 'alice@example.com' });

            // Table.Record calls Table.Records, which expects an array
            mockAdapter.setMockResults('SELECT * FROM "users"', [mockUser]);

            const table = new Table('users');
            const record = await table.Record({ where: { id: 1 } });

            expect(record).toBeDefined();
            // Check that a query with LIMIT was executed
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('LIMIT'))).toBe(true);
        });

        it('should return undefined when no record matches', async () => {
            mockAdapter.setMockRow('SELECT * FROM "users" WHERE "id" = ? LIMIT 1', undefined);

            const table = new Table('users');
            const record = await table.Record({ where: { id: 999 } });

            expect(record).toBeUndefined();
        });
    });

    describe('Insert', () => {
        it('should insert a new record', async () => {
            const table = new Table('users');
            await table.Insert({ name: 'Charlie', email: 'charlie@example.com' });

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('INSERT INTO'))).toBe(true);
        });
    });

    describe('Drop', () => {
        it('should drop the table', async () => {
            const table = new Table('users');
            await table.Drop();

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('DROP TABLE'))).toBe(true);
        });
    });

    describe('Count', () => {
        it('should count all records in table', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM "users"', { count: '5' });

            const table = new Table('users');
            const count = await table.RecordsCount();

            expect(count).toBe(5);
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('COUNT(*)'))).toBe(true);
        });

        it('should count records returns 0 when empty', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM "users"', { count: '0' });

            const table = new Table('users');
            const count = await table.RecordsCount();

            expect(count).toBe(0);
        });
    });

    describe('Join operations', () => {
        it('should perform INNER JOIN', async () => {
            const mockResults = [
                createMockRow({ 
                    'users.id': 1, 
                    'users.name': 'Alice', 
                    'posts.title': 'Post 1' 
                })
            ];

            mockAdapter.setMockResults('SELECT * FROM "users" INNER JOIN', mockResults);

            const table = new Table('users');
            const records = await table.Join({
                fromTable: 'users',
                baseTable: 'posts',
                joinType: 'INNER',
                on: { user_id: 'id' }
            })
            expect(records).toBeDefined();
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('INNER JOIN'))).toBe(true);
        });

        it('should perform LEFT JOIN', async () => {
            const table = new Table('users');
            await table.Join({
                fromTable: 'users',
                baseTable: 'posts',
                joinType: 'LEFT',
                on: { user_id: 'id' }
            })

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('LEFT JOIN'))).toBe(true);
        });
    });
});
