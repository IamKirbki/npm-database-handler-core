# IStatementAdapter

Interface for executing prepared SQL statements with parameter binding.

## Overview

`IStatementAdapter` wraps database-specific statement objects to provide a unified interface for query execution. Each adapter must implement this interface to enable parameter binding and result retrieval.

## Interface Definition

```typescript
interface IStatementAdapter {
    run(parameters?: Record<string, any>): Promise<RunResult>;
    all(parameters?: Record<string, any>): Promise<any[]>;
    get(parameters?: Record<string, any>): Promise<any>;
    runSync?(parameters?: Record<string, any>): RunResult;
}
```

**Note:** `runSync()` is optional and only needed for databases supporting synchronous operations (like SQLite in transactions).

---

## Methods

### `run(parameters)`

Execute a query that modifies data (INSERT, UPDATE, DELETE).

**Parameters:**
- `parameters` (Record<string, any>) - Optional parameter bindings

**Returns:** `Promise<RunResult>`

```typescript
type RunResult = {
    changes: number;     // Number of rows affected
    lastInsertRowid?: number | bigint; // Last inserted row ID
};
```

**Example:**
```typescript
const result = await statement.run({ 
    name: 'John', 
    email: 'john@example.com' 
});

console.log(`Inserted ${result.changes} row(s)`);
console.log(`New ID: ${result.lastInsertRowid}`);
```

---

### `all(parameters)`

Execute a query and return all matching rows.

**Parameters:**
- `parameters` (Record<string, any>) - Optional parameter bindings

**Returns:** `Promise<any[]>`

**Example:**
```typescript
const users = await statement.all({ role: 'admin' });

users.forEach(user => {
    console.log(user.name, user.email);
});
```

---

### `get(parameters)`

Execute a query and return the first matching row.

**Parameters:**
- `parameters` (Record<string, any>) - Optional parameter bindings

**Returns:** `Promise<any>` - Single row or undefined

**Example:**
```typescript
const user = await statement.get({ id: 1 });

if (user) {
    console.log(user.name);
}
```

---

### `runSync(parameters)` (Optional)

Execute a query synchronously. Only implement for databases that support synchronous operations.

**Parameters:**
- `parameters` (Record<string, any>) - Optional parameter bindings

**Returns:** `RunResult`

**When to implement:**
- Database library supports synchronous operations (better-sqlite3)
- Needed for transaction support
- Performance optimization for batch operations

**Example:**
```typescript
// Inside a transaction
const result = statement.runSync({ status: 'active' });
console.log(`Updated ${result.changes} rows`);
```

---

## Creating a Statement Adapter

### Async-Only Implementation (PostgreSQL, MySQL)

```typescript
import { IStatementAdapter, RunResult } from '@iamkirbki/database-handler-core';

export default class MyDatabaseStatement implements IStatementAdapter {
    private statement: any;
    private client: any;

    constructor(query: string, client: any) {
        this.client = client;
        this.statement = query;
    }

    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const [query, params] = this.convertParameters(this.statement, parameters || {});
        const result = await this.client.query(query, params);
        
        return {
            changes: result.rowCount || 0,
            lastInsertRowid: result.rows[0]?.id
        };
    }

    async all(parameters?: Record<string, any>): Promise<any[]> {
        const [query, params] = this.convertParameters(this.statement, parameters || {});
        const result = await this.client.query(query, params);
        return result.rows;
    }

    async get(parameters?: Record<string, any>): Promise<any> {
        const [query, params] = this.convertParameters(this.statement, parameters || {});
        const result = await this.client.query(query, params);
        return result.rows[0];
    }

    private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
        const paramList: any[] = [];
        let index = 1;
        
        const convertedQuery = query.replace(/@(\w+)/g, (match, paramName) => {
            paramList.push(params[paramName]);
            return `$${index++}`;
        });
        
        return [convertedQuery, paramList];
    }
}
```

### Sync + Async Implementation (SQLite)

```typescript
import { IStatementAdapter, RunResult } from '@iamkirbki/database-handler-core';
import Database from 'better-sqlite3';

export default class MyDatabaseStatement implements IStatementAdapter {
    private statement: Database.Statement;

    constructor(statement: Database.Statement) {
        this.statement = statement;
    }

    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const result = this.statement.run(parameters || {});
        
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }

    async all(parameters?: Record<string, any>): Promise<any[]> {
        return this.statement.all(parameters || {});
    }

    async get(parameters?: Record<string, any>): Promise<any> {
        return this.statement.get(parameters || {});
    }

    // Optional: for transaction support
    runSync(parameters?: Record<string, any>): RunResult {
        const result = this.statement.run(parameters || {});
        
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }
}
```

---

## Real-World Examples

### PostgreSQL Statement

```typescript
export default class PostgresStatement implements IStatementAdapter {
    private query: string;
    private client: any;

    constructor(query: string, client: any) {
        this.client = client;
        this.query = query;
    }

    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const [query, params] = this.parameterReplacer(this.query, parameters || {});
        const result = await this.client.query(query, params);
        
        return {
            changes: result.rowCount || 0,
            lastInsertRowid: result.rows[0]?.id
        };
    }

    async all(parameters?: Record<string, any>): Promise<any[]> {
        const [query, params] = this.parameterReplacer(this.query, parameters || {});
        const result = await this.client.query(query, params);
        return result.rows;
    }

    async get(parameters?: Record<string, any>): Promise<any> {
        const [query, params] = this.parameterReplacer(this.query, parameters || {});
        const result = await this.client.query(query, params);
        return result.rows[0];
    }

    private parameterReplacer(query: string, parameters: Record<string, any>): [string, any[]] {
        const parameterKeys = Object.keys(parameters);
        const parameterValues: any[] = [];

        const result = query.replace(/@(\w+)/g, (match, key) => {
            const index = parameterKeys.indexOf(key);
            if (index !== -1) {
                parameterValues.push(parameters[key]);
                return `$${parameterValues.length}`;
            }
            return match;
        });

        return [result, parameterValues];
    }
}
```

### SQLite Statement

```typescript
export default class BetterSqlite3Statement implements IStatementAdapter {
    private statement: Database.Statement;

    constructor(statement: Database.Statement) {
        this.statement = statement;
    }

    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const result = this.statement.run(parameters || {});
        
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }

    async all(parameters?: Record<string, any>): Promise<any[]> {
        return this.statement.all(parameters || {});
    }

    async get(parameters?: Record<string, any>): Promise<any> {
        return this.statement.get(parameters || {});
    }

    runSync(parameters?: Record<string, any>): RunResult {
        const result = this.statement.run(parameters || {});
        
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }
}
```

---

## Parameter Conversion Patterns

### PostgreSQL ($1, $2, $3)

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    const paramList: any[] = [];
    let index = 1;
    
    const converted = query.replace(/@(\w+)/g, (match, paramName) => {
        paramList.push(params[paramName]);
        return `$${index++}`;
    });
    
    return [converted, paramList];
}
```

### MySQL/MariaDB (?)

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    const paramList: any[] = [];
    
    const converted = query.replace(/@(\w+)/g, (match, paramName) => {
        paramList.push(params[paramName]);
        return '?';
    });
    
    return [converted, paramList];
}
```

### SQLite (native @paramName)

```typescript
// No conversion needed - SQLite supports @paramName natively
// Just pass parameters directly
const result = this.statement.run(parameters);
```

---

## Transaction Support

For databases that support synchronous operations, implement `runSync()` to enable transaction batching:

```typescript
// With runSync support
const commit = await adapter.transaction((items) => {
    items.forEach(item => {
        statement.runSync(item); // Synchronous execution
    });
});

await commit();
```

**Without runSync:**
```typescript
// Must use async operations
const commit = await adapter.transaction(async (items) => {
    for (const item of items) {
        await statement.run(item); // Async execution
    }
});

await commit();
```

---

## Testing Your Statement Adapter

```typescript
import { describe, it, expect } from 'vitest';

describe('MyDatabaseStatement', () => {
    it('should execute run and return changes', async () => {
        const result = await statement.run({ name: 'Test' });
        expect(result.changes).toBeGreaterThan(0);
    });

    it('should fetch all rows', async () => {
        const rows = await statement.all({ status: 'active' });
        expect(Array.isArray(rows)).toBe(true);
    });

    it('should fetch single row', async () => {
        const row = await statement.get({ id: 1 });
        expect(row).toBeDefined();
    });

    it('should handle empty parameters', async () => {
        const rows = await statement.all();
        expect(Array.isArray(rows)).toBe(true);
    });
});
```

---

## See Also

- [IDatabaseAdapter](IDatabaseAdapter.md) - Database adapter interface
- [Query](../../base/Wiki/Query.md) - Using prepared statements
- [PostgreSQL Statement](../../../pg/src/PostgresStatement.ts) - Reference implementation
- [SQLite Statement](../../../bettersqlite3/src/BetterSqlite3Statement.ts) - Reference implementation
