import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { QueryEvaluationPhase } from '../../types/expressions';
import { Model } from '../../abstract/Model';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/testHelpers';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';

interface UserFields {
  id: number;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

class UserModel extends Model<UserFields> {
  protected configuration = {
    table: 'users',
    primaryKey: 'id',
    incrementing: true,
    keyType: 'number' as const,
    timestamps: true,
    createdAtColumn: 'created_at',
    updatedAtColumn: 'updated_at',
    guarded: ['*'],
  };
}

describe('Model', () => {
  let mockAdapter: MockDatabaseAdapter;

  beforeEach(() => {
    mockAdapter = setupTestEnvironment();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe('Basic Configuration', () => {
    it('should have correct table name', () => {
      const user = new UserModel();
      expect(user.Configuration.table).toBe('users');
    });

    it('should have correct primary key column', () => {
      const user = new UserModel();
      expect(user.primaryKeyColumn).toBe('id');
    });
  });

  describe('Attributes and Values', () => {
    it('should set and get attributes', () => {
      const user = new UserModel();
      user.set({ name: 'John Doe', email: 'john@example.com' });
      expect(user.values).toEqual({ name: 'John Doe', email: 'john@example.com' });
    });

    it('should return attributes via toJSON', () => {
      const user = new UserModel();
      const data = { name: 'John Doe', email: 'john@example.com' };
      user.set(data);
      expect(user.toJSON()).toEqual(data);
    });

    it('should return attributes via toObject', () => {
      const user = new UserModel();
      const data = { name: 'John Doe', email: 'john@example.com' };
      user.set(data);
      expect(user.toObject()).toEqual(data);
    });
  });

  describe('Query Building (Fluent Interface)', () => {
    it('should add limit to query layers', () => {
      const user = new UserModel().limit(10);
      // Accessing private queryLayers for verification
      expect((user as any).queryLayers.final.limit).toBe(10);
    });

    it('should throw error when setting offset without limit', () => {
      const user = new UserModel();
      expect(() => user.offset(5)).toThrow('Offset cannot be set without a limit.');
    });

    it('should add offset to query layers when limit is set', () => {
      const user = new UserModel().limit(10).offset(5);
      expect((user as any).queryLayers.final.offset).toBe(5);
    });

    it('should add orderBy to query layers', () => {
      const user = new UserModel().orderBy('name', 'DESC');
      expect((user as any).queryLayers.final.orderBy).toContainEqual({
        column: 'name',
        direction: 'DESC',
      });
    });

    it('should add where conditions to query layers', () => {
      const user = new UserModel().where({ name: 'John' });
      expect((user as any).queryLayers.base.where).toEqual([
        {
          column: 'name',
          operator: '=',
          value: 'John',
        },
      ]);
    });

    it('should stack multiple where conditions', () => {
      const user = new UserModel().where({ name: 'John' }).where({ email: 'john@example.com' });
      const where = (user as any).queryLayers.base.where;
      expect(where).toEqual([
        {
          column: 'name',
          operator: '=',
          value: 'John',
        },
        {
          column: 'email',
          operator: '=',
          value: 'john@example.com',
        },
      ]);
    });
  });

  describe('Static Query Methods', () => {
    it('static limit should return a model instance with limit set', () => {
      const user = UserModel.limit(10);
      expect(user).toBeInstanceOf(UserModel);
      expect((user as any).queryLayers.final.limit).toBe(10);
    });

    it('static where should return a model instance with where set', () => {
      const user = UserModel.where({ name: 'John' });
      expect(user).toBeInstanceOf(UserModel);
      expect((user as any).queryLayers.base.where).toEqual([
        {
          column: 'name',
          operator: '=',
          value: 'John',
        },
      ]);
    });

    it('static find should set where condition for primary key', () => {
      const user = UserModel.find(1);
      expect((user as any).queryLayers.base.where).toEqual([
        {
          column: 'id',
          operator: '=',
          value: 1,
        },
      ]);
    });
  });

  describe('Persistence Operations', () => {
    it('save should call repository save and update state', async () => {
      const user = new UserModel();
      user.set({ name: 'New User' });
      
      const saveSpy = vi.spyOn((user as any).repository, 'save').mockResolvedValue({ id: 1, name: 'New User' });
      
      await user.save();
      
      expect(saveSpy).toHaveBeenCalled();
      expect((user as any).exists).toBe(true);
      expect((user as any).dirty).toBe(false);
    });

    it('update should call repository update and refresh attributes', async () => {
      const user = new UserModel();
      // Mocking existing record
      (user as any).exists = true;
      (user as any).originalAttributes = { id: 1, name: 'Old Name' };
      (user as any).attributes = { id: 1, name: 'Old Name' };

      const updateSpy = vi.spyOn((user as any).repository, 'update').mockResolvedValue({ id: 1, name: 'Updated Name' });
      
      await user.update({ name: 'Updated Name' });
      
      expect(updateSpy).toHaveBeenCalledWith({ id: 1 }, { name: 'Updated Name' }, 'users');
      expect(user.values.name).toBe('Updated Name');
    });

    it('update should throw if primary key is missing', async () => {
      const user = new UserModel();
      await expect(user.update({ name: 'Fail' })).rejects.toThrow('Primary key value is undefined');
    });
  });

  describe('Retrieval Operations', () => {
    it('first() should fetch a single record and populate model', async () => {
      const user = new UserModel();
      const mockData = { id: 1, name: 'Fetched User' };
      
      vi.spyOn((user as any).repository, 'first').mockResolvedValue(mockData);
      
      await user.first(1);
      
      expect(user.values.name).toBe('Fetched User');
      expect((user as any).exists).toBe(true);
    });

    it('findOrFail() should throw if no record found', async () => {
      const user = new UserModel();
      vi.spyOn((user as any).repository, 'first').mockResolvedValue(null);
      
      await expect(user.findOrFail(999)).rejects.toThrow("No record found in table 'users' matching identifier '999'");
    });

    it('all() should return array of model instances', async () => {
      const user = new UserModel();
      const mockRecords = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];
      
      vi.spyOn((user as any).repository, 'all').mockResolvedValue(mockRecords);
      
      const results = await user.all();
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(UserModel);
      expect(results[0].values.name).toBe('User 1');
      expect((results[0] as any).exists).toBe(true);
    });
  });
});
