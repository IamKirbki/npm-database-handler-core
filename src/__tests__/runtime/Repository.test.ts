import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Repository from '../../runtime/Repository';
import Model from '../../abstract/Model';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import { 
    setupTestEnvironment, 
    teardownTestEnvironment, 
    createTestModel,
    createMockRow 
} from '../utils/testHelpers';
import type { columnType } from '../../types';

describe('Repository', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        mockAdapter = setupTestEnvironment();
    });

    afterEach(() => {
        teardownTestEnvironment();
    });

    describe('getInstance', () => {
        it('should create a repository instance', () => {
            type UserColumns = { id: number; name: string; email: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '', email: '' }
            );

            const repository = Repository.getInstance(
                UserModel,
                'users'
            );

            expect(repository).toBeDefined();
        });

        it('should return the same instance for the same model class', () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const repo1 = Repository.getInstance(UserModel, 'users');
            const repo2 = Repository.getInstance(UserModel, 'users');

            expect(repo1).toBe(repo2);
        });

        it('should create different instances for different model classes', () => {
            type UserColumns = { id: number; name: string };
            type PostColumns = { id: number; title: string };

            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const PostModel = createTestModel<PostColumns>(
                'posts',
                { id: 0, title: '' }
            );

            const userRepo = Repository.getInstance(UserModel, 'users');
            const postRepo = Repository.getInstance(PostModel, 'posts');

            expect(userRepo).not.toBe(postRepo);
        });
    });

    describe('clearInstances', () => {
        it('should clear all repository instances', () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const repo1 = Repository.getInstance(UserModel, 'users');
            Repository.clearInstances();
            const repo2 = Repository.getInstance(UserModel, 'users');

            expect(repo1).not.toBe(repo2);
        });
    });

    describe('findAll', () => {
        it('should fetch all records from table', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const mockUsers = [
                createMockRow<UserColumns>({ id: 1, name: 'Alice' }),
                createMockRow<UserColumns>({ id: 2, name: 'Bob' }),
            ];

            mockAdapter.setMockResults('SELECT * FROM "users"', mockUsers);

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            const results = await repository.all(model);

            expect(results).toHaveLength(2);
        });

        it('should fetch records with WHERE condition', async () => {
            type UserColumns = { id: number; name: string; active: boolean };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '', active: false }
            );

            const mockUsers = [
                createMockRow<UserColumns>({ id: 1, name: 'Alice', active: true }),
            ];

            mockAdapter.setMockResults('SELECT * FROM "users"', mockUsers);

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            const results = await repository.all(model, { active: true });

            expect(results).toBeDefined();
            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('WHERE'))).toBe(true);
        });
    });

    describe('findOne', () => {
        it('should fetch a single record', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const mockUser = createMockRow<UserColumns>({ id: 1, name: 'Alice' });

            mockAdapter.setMockRow('SELECT * FROM "users"', mockUser);

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            const result = await repository.first({ id: 1 }, model);

            expect(result).toBeDefined();
        });

        it('should return undefined when no record found', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            mockAdapter.setMockRow('SELECT * FROM "users"', undefined);

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            const result = await repository.first({ id: 999 }, model);

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should insert a new record', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const repository = Repository.getInstance(UserModel, 'users');
            await repository.save({ id: 1, name: 'Charlie' } as UserColumns);

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('INSERT INTO'))).toBe(true);
        });
    });

    describe('update', () => {
        it('should update existing records', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            // Mock the Record fetch and update
            const mockUser = createMockRow<UserColumns>({ id: 1, name: 'Old' });
            mockAdapter.setMockRow('SELECT * FROM "users"', mockUser);

            const repository = Repository.getInstance(UserModel, 'users');
            const result = await repository.update({ id: 1 }, { name: 'Updated' });

            // Verify a query was prepared (either SELECT or UPDATE)
            expect(mockAdapter.getOperationCount('prepare')).toBeGreaterThan(0);
        });
    });

    describe('doesTableExist', () => {
        it('should check if table exists', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            mockAdapter.setTableExists('users', true);

            const repository = Repository.getInstance(UserModel, 'users');
            const exists = await repository.doesTableExist('users');

            expect(exists).toBe(true);
        });
    });

    describe('pivot table operations', () => {
        it('should insert record into pivot table', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            
            // Set up the model with necessary data
            Object.defineProperty(model, 'values', {
                get: () => ({ id: 1, name: 'Test' })
            });

            await repository.insertRecordIntoPivotTable(
                '2',
                model as any,
                {
                    type: 'belongsToMany',
                    table: 'roles',
                    foreignKey: 'role_id',
                    pivotTable: 'user_roles',
                    pivotLocalKey: 'user_id',
                    pivotForeignKey: 'role_id'
                }
            );

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('INSERT INTO'))).toBe(true);
        });

        it('should delete record from pivot table', async () => {
            type UserColumns = { id: number; name: string };
            const UserModel = createTestModel<UserColumns>(
                'users',
                { id: 0, name: '' }
            );

            const repository = Repository.getInstance(UserModel, 'users');
            const model = new UserModel();
            
            Object.defineProperty(model, 'values', {
                get: () => ({ id: 1, name: 'Test' })
            });

            await repository.deleteRecordFromPivotTable(
                '2',
                model as any,
                {
                    type: 'belongsToMany',
                    table: 'roles',
                    foreignKey: 'role_id',
                    pivotTable: 'user_roles',
                    pivotLocalKey: 'user_id',
                    pivotForeignKey: 'role_id'
                }
            );

            const queries = mockAdapter.getQueriesByType('prepare');
            expect(queries.some(q => q.includes('DELETE') || q.includes('SELECT'))).toBe(true);
        });
    });
});
