import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Table from '@core/base/Table';
import Record from '@core/base/Record';
import Container from '@core/runtime/Container';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';

describe('Table', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        Container.resetInstance();
        mockAdapter = new MockDatabaseAdapter();
        Container.getInstance().registerAdapter('default', mockAdapter, true);
        mockAdapter.setTableExists('users', true);
        mockAdapter.setTableExists('posts', true);
    });

    afterEach(() => {
        Container.resetInstance();
    });

    describe('constructor', () => {
        it('should create a table instance', () => {
            const table = new Table({ name: 'users' });
            expect(table).toBeDefined();
        });

        it('should use custom adapter when specified', () => {
            Container.getInstance().registerAdapter('custom', mockAdapter);
            const table = new Table({ name: 'users', adapter: 'custom' });
            expect(table).toBeDefined();
        });

        it('should use custom query factory', () => {
            let factoryCalled = false;
            const customFactory = {
                create: () => {
                    factoryCalled = true;
                    throw new Error('Custom factory called');
                }
            };
            try {
                new Table({ name: 'users', adapter: 'default', queryFactory: customFactory as any });
            } catch (e) {
                // Expected - factory is called during construction
            }
            expect(factoryCalled).toBe(true);
        });
    });

    describe('Records', () => {
        it('should fetch records with proper QueryLayers format', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users"', [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ]);

            const table = new Table({ name: 'users' });
            const records = await table.FetchRecords({
                base: { from: 'users' }
            });

            expect(records).toHaveLength(2);
        });

        it('should apply where conditions', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users"', [
                { id: 1, name: 'Alice' }
            ]);

            const table = new Table({ name: 'users' });
            const records = await table.FetchRecords({
                base: {
                    from: 'users',
                    where: [{ column: 'id', operator: '=', value: 1 }]
                }
            });

            expect(records).toBeDefined();
        });

        it('should apply orderBy', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users"', []);

            const table = new Table({ name: 'users' });
            await table.FetchRecords({
                base: { from: 'users' },
                final: { orderBy: [{ column: 'name', direction: 'ASC' }] }
            });

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('ORDER BY'))).toBe(true);
        });

        it('should apply limit and offset', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users"', []);

            const table = new Table({ name: 'users' });
            await table.FetchRecords({
                base: { from: 'users' },
                final: { limit: 10, offset: 5 }
            });

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('LIMIT'))).toBe(true);
            expect(queries.some(q => q.includes('OFFSET'))).toBe(true);
        });
    });

    describe('Record (single)', () => {
        it('should return single record with limit', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users" LIMIT 1', [
                { id: 1, name: 'Alice' }
            ]);

            const table = new Table({ name: 'users' });
            const record = await table.FetchSingleRecord({
                base: { from: 'users' }
            });

            expect(record).toBeDefined();
            expect(record?.values.name).toBe('Alice');
        });

        it('should return undefined when no record found', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users" LIMIT 1', []);

            const table = new Table({ name: 'users' });
            const record = await table.FetchSingleRecord({
                base: { from: 'users' }
            });

            expect(record).toBeUndefined();
        });
    });

    describe('Insert', () => {
        it('should insert a record', async () => {
            const table = new Table({ name: 'users' });
            await table.CreateRecord({ name: 'Charlie', email: 'charlie@example.com' });

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('INSERT INTO'))).toBe(true);
        });

        it('should insert multiple records', async () => {
            const table = new Table({ name: 'users' });
            await table.CreateRecord({ name: 'Alice', email: 'alice@example.com' });
            await table.CreateRecord({ name: 'Bob', email: 'bob@example.com' });

            const queries = mockAdapter.getQueriesByType('prepare');
            const insertQueries = queries.filter(q => q.includes('INSERT INTO'));
            expect(insertQueries).toHaveLength(2);
        });
    });

    describe('RecordsCount', () => {
        it('should return count', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM "users"', { count: '5' });

            const table = new Table({ name: 'users' });
            const count = await table.RecordsCount();

            expect(count).toBe(5);
        });

        it('should return 0 for empty table', async () => {
            mockAdapter.setMockRow('SELECT COUNT(*) as count FROM "users"', { count: '0' });

            const table = new Table({ name: 'users' });
            const count = await table.RecordsCount();

            expect(count).toBe(0);
        });
    });

    describe('Drop', () => {
        it('should drop table', async () => {
            const table = new Table({ name: 'users' });
            await table.Drop();

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('DROP TABLE'))).toBe(true);
        });
    });

    describe('exists', () => {
        it('should return true when table exists', async () => {
            mockAdapter.setTableExists('users', true);
            const table = new Table({ name: 'users' });
            const exists = await table.exists();
            expect(exists).toBe(true);
        });

        it('should return false when table does not exist', async () => {
            mockAdapter.setTableExists('nonexistent', false);
            const table = new Table({ name: 'nonexistent' });
            const exists = await table.exists();
            expect(exists).toBe(false);
        });
    });

    describe('TableColumnInformation', () => {
        it('should get column information', async () => {
            mockAdapter.setMockTableColumns('users', [
                { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
            ]);

            const table = new Table({ name: 'users' });
            const columns = await table.TableColumnInformation();

            expect(columns).toHaveLength(2);
            expect(columns[0].name).toBe('id');
        });

        it('should get readable column information', async () => {
            mockAdapter.setMockTableColumns('users', [
                { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                { cid: 1, name: 'email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
            ]);

            const table = new Table({ name: 'users' });
            const columns = await table.ReadableTableColumnInformation();

            expect(columns).toHaveLength(2);
            expect(columns[0].isPrimaryKey).toBe(true);
            expect(columns[1].nullable).toBe(true);
        });
    });

    describe('Join', () => {
        it('should throw error when no joins defined', async () => {
            const table = new Table({ name: 'users' });
            
            await expect(table.FetchJoined({
                base: { from: 'users' }
            })).rejects.toThrow('No joins defined');
        });

        it('should perform join when joins are defined', async () => {
            mockAdapter.setMockResults('SELECT * FROM "users" INNER JOIN', [
                { 'users__id': 1, 'users__name': 'Alice', 'posts__title': 'Post 1' }
            ]);

            const table = new Table({ name: 'users' });
            await table.FetchJoined({
                base: {
                    from: 'users',
                    joins: [{
                        fromTable: 'posts',
                        baseTable: 'users',
                        joinType: 'INNER',
                        name: 'posts',
                        on: [{ 'posts.user_id': 'users.id' }]
                    }]
                }
            });

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('JOIN'))).toBe(true);
        });
    });
});
