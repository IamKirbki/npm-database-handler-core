# Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) for unit testing. The test setup includes mock implementations of database adapters and helper utilities to make testing easier.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

```
packages/core/src/__tests__/
├── mocks/                      # Mock implementations
│   ├── MockDatabaseAdapter.ts  # Mock database adapter
│   ├── MockStatementAdapter.ts # Mock statement adapter
│   └── MockSchemaBuilder.ts    # Mock schema builder
├── utils/                      # Test utilities
│   └── testHelpers.ts          # Helper functions for tests
├── base/                       # Tests for base classes
│   ├── Table.test.ts
│   ├── Query.test.ts
│   └── Record.test.ts
└── runtime/                    # Tests for runtime classes
    ├── Repository.test.ts
    └── Container.test.ts
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/testHelpers';

describe('MyClass', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        mockAdapter = setupTestEnvironment();
    });

    afterEach(() => {
        teardownTestEnvironment();
    });

    it('should do something', async () => {
        // Arrange
        mockAdapter.setMockResults('SELECT * FROM users', [
            { id: 1, name: 'Alice' }
        ]);

        // Act
        const result = await myFunction();

        // Assert
        expect(result).toBeDefined();
        expect(mockAdapter.hasExecuted('SELECT')).toBe(true);
    });
});
```

### Using Mock Adapter

The `MockDatabaseAdapter` tracks all database operations:

```typescript
// Set mock data for queries
mockAdapter.setMockResults('SELECT * FROM users', [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
]);

// Set mock single row result
mockAdapter.setMockRow('SELECT * FROM users WHERE id = ?', { id: 1, name: 'Alice' });

// Check if a query was executed
expect(mockAdapter.hasExecuted('SELECT')).toBe(true);

// Get count of specific operations
const selectCount = mockAdapter.getOperationCount('prepare');

// Get all queries of a specific type
const selectQueries = mockAdapter.getQueriesByType('prepare');

// Clear all mock data
mockAdapter.clear();
```

### Creating Test Models

Use the `createTestModel` helper to create test model classes:

```typescript
import { createTestModel } from '../utils/testHelpers';

type UserColumns = { id: number; name: string; email: string };

const UserModel = createTestModel<UserColumns>(
    'users',                              // table name
    { id: 0, name: '', email: '' },      // columns
    'id'                                  // primary key (optional)
);

const user = new UserModel();
```

### Testing with Repository

```typescript
import Repository from '../../runtime/Repository';
import { createTestModel } from '../utils/testHelpers';

it('should fetch all users', async () => {
    type UserColumns = { id: number; name: string };
    const UserModel = createTestModel<UserColumns>('users', { id: 0, name: '' });

    mockAdapter.setMockResults('SELECT * FROM "users"', [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
    ]);

    const repository = Repository.getInstance(UserModel, 'users');
    const users = await repository.findAll();

    expect(users).toHaveLength(2);
});
```

### Assertions

```typescript
// Check query execution
expect(mockAdapter.hasExecuted('INSERT INTO')).toBe(true);

// Check operation counts
expect(mockAdapter.getOperationCount('prepare')).toBe(2);

// Check specific queries
const queries = mockAdapter.getQueriesByType('prepare');
expect(queries.some(q => q.includes('WHERE'))).toBe(true);

// Check results
expect(result).toBeDefined();
expect(result).toHaveLength(2);
expect(result[0].name).toBe('Alice');
```

## Test Coverage

To generate a coverage report:

```bash
npm run test:coverage
```

This will create a coverage report in the `coverage/` directory.

## Best Practices

1. **Always use `setupTestEnvironment()` and `teardownTestEnvironment()`** to ensure a clean state between tests
2. **Mock external dependencies** using the provided mock adapters
3. **Test one thing per test** - keep tests focused and specific
4. **Use descriptive test names** - describe what the test does and what's expected
5. **Follow AAA pattern** - Arrange, Act, Assert
6. **Clean up after tests** - use `afterEach` to reset state
7. **Test edge cases** - don't just test the happy path

## Common Patterns

### Testing async operations

```typescript
it('should fetch data asynchronously', async () => {
    mockAdapter.setMockResults('SELECT * FROM users', [{ id: 1 }]);
    
    const result = await fetchUsers();
    
    expect(result).toBeDefined();
});
```

### Testing error conditions

```typescript
it('should throw error when query fails', async () => {
    const query = new Query({ tableName: 'users' });
    
    await expect(query.Run()).rejects.toThrow('No query defined');
});
```

### Testing with transactions

```typescript
it('should execute within transaction', () => {
    mockAdapter.transaction(() => {
        // Your transaction logic
    });
    
    expect(mockAdapter.getOperationCount('transaction_start')).toBe(1);
    expect(mockAdapter.getOperationCount('transaction_commit')).toBe(1);
});
```

## Troubleshooting

### Tests failing due to singleton instances

Make sure you're calling `teardownTestEnvironment()` in `afterEach`:

```typescript
afterEach(() => {
    teardownTestEnvironment();
});
```

### Mock data not being returned

Ensure the query string matches exactly:

```typescript
// This won't work if the actual query has different spacing/formatting
mockAdapter.setMockResults('SELECT * FROM users', [data]);

// Use regex or partial matching in assertions instead
expect(mockAdapter.hasExecuted('SELECT')).toBe(true);
```

### TypeScript errors in tests

Make sure your test file imports the correct types:

```typescript
import type { columnType } from '../../types';
```
