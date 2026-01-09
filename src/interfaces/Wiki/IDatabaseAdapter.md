# IDatabaseAdapter

Core interface that all database adapters must implement to integrate with the database handler.

## Overview

`IDatabaseAdapter` defines the contract for database connectivity and operations. Any database system can be integrated by implementing this interface.

## Interface Definition

```typescript
interface IDatabaseAdapter {
    connect(params: unknown): Promise<void>;
    prepare(query: string): Promise<IStatementAdapter>;
    exec(query: string): Promise<void>;
    transaction(fn: (items: any[]) => void): Promise<Function>;
    tableColumnInformation(tableName: string): Promise<TableColumnInfo[]>;
    close(): Promise<void>;
}
```

---

## Methods

### `connect(params)`

Establish connection to the database.

**Parameters:**
- `params` (unknown) - Database-specific connection configuration

**Returns:** `Promise<void>`

**Example:**
```typescript
// PostgreSQL
await adapter.connect({
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'postgres',
    password: 'secret'
});

// SQLite
await adapter.connect('./database.db');
```

---

### `prepare(query)`

Prepare a SQL query for execution.

**Parameters:**
- `query` (string) - SQL query string with `@paramName` parameters

**Returns:** `Promise<IStatementAdapter>`

**Example:**
```typescript
const statement = await adapter.prepare('SELECT * FROM users WHERE id = @id');
const user = await statement.get({ id: 1 });
```

---

### `exec(query)`

Execute a SQL query without returning results (for DDL statements).

**Parameters:**
- `query` (string) - SQL query string

**Returns:** `Promise<void>`

**Example:**
```typescript
await adapter.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
```

---

### `transaction(fn)`

Execute operations within a database transaction.

**Parameters:**
- `fn` ((items: any[]) => void) - Function containing transaction operations

**Returns:** `Promise<Function>` - Commit or rollback function

**Example:**
```typescript
const commit = await adapter.transaction(() => {
    // Transaction operations
});
await commit();
```

---

### `tableColumnInformation(tableName)`

Retrieve column metadata for a table.

**Parameters:**
- `tableName` (string) - Name of the table

**Returns:** `Promise<TableColumnInfo[]>`

**TableColumnInfo Structure:**
```typescript
type TableColumnInfo = {
    cid: number;           // Column ID/position
    name: string;          // Column name
    type: string;          // Data type
    notnull: number;       // 1 if NOT NULL, 0 otherwise
    dflt_value: string | null; // Default value
    pk: number;            // 1 if primary key, 0 otherwise
};
```

---

### `close()`

Close the database connection.

**Returns:** `Promise<void>`

**Example:**
```typescript
await adapter.close();
```

---

## Creating a Custom Adapter

To create an adapter for a new database system, implement the `IDatabaseAdapter` interface:

### Step 1: Create Adapter Class

```typescript
import { IDatabaseAdapter, IStatementAdapter, TableColumnInfo } from '@iamkirbki/database-handler-core';

export default class MyDatabaseAdapter implements IDatabaseAdapter {
    private connection: any = null;

    async connect(params: unknown): Promise<void> {
        // Establish database connection
        this.connection = await createConnection(params);
    }

    async prepare(query: string): Promise<IStatementAdapter> {
        // Convert @paramName syntax to your database's parameter format
        const convertedQuery = this.convertParameters(query);
        const statement = await this.connection.prepare(convertedQuery);
        return new MyDatabaseStatement(statement);
    }

    async exec(query: string): Promise<void> {
        await this.connection.execute(query);
    }

    async transaction(fn: (items: any[]) => void): Promise<Function> {
        await this.connection.beginTransaction();
        
        try {
            fn([]);
            return async () => await this.connection.commit();
        } catch (error) {
            await this.connection.rollback();
            throw error;
        }
    }

    async tableColumnInformation(tableName: string): Promise<TableColumnInfo[]> {
        // Query your database's information schema
        const columns = await this.connection.query(
            `SELECT * FROM information_schema.columns WHERE table_name = ?`,
            [tableName]
        );
        
        return columns.map((col, index) => ({
            cid: index,
            name: col.column_name,
            type: col.data_type,
            notnull: col.is_nullable === 'NO' ? 1 : 0,
            dflt_value: col.column_default,
            pk: col.is_primary ? 1 : 0
        }));
    }

    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
    }

    private convertParameters(query: string): string {
        // Convert @paramName to your database's format (?, $1, etc.)
        return query.replace(/@(\w+)/g, '?');
    }
}
```

### Step 2: Create Statement Adapter

See [IStatementAdapter](IStatementAdapter.md) for details.

### Step 3: Package Your Adapter

Create a package structure:

```
my-database-adapter/
├── package.json
├── src/
│   ├── MyDatabaseAdapter.ts
│   ├── MyDatabaseStatement.ts
│   └── index.ts
└── README.md
```

**package.json:**
```json
{
  "name": "@yourorg/database-handler-mydatabase",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@iamkirbki/database-handler-core": "^1.0.0"
  }
}
```

**index.ts:**
```typescript
export { default as MyDatabaseAdapter } from './MyDatabaseAdapter';
export { default as MyDatabaseStatement } from './MyDatabaseStatement';
```

---

## Real-World Examples

### PostgreSQL Adapter

```typescript
import { IDatabaseAdapter, IStatementAdapter, TableColumnInfo } from "@iamkirbki/database-handler-core";
import { Pool, PoolConfig } from "pg";
import PostgresStatement from "./PostgresStatement.js";

export default class PostgresAdapter implements IDatabaseAdapter {
    private _pool: Pool | null = null;

    async connect(config: PoolConfig): Promise<void> {
        this._pool = new Pool(config);
    }

    async prepare(query: string): Promise<IStatementAdapter> {
        const client = await this._pool?.connect();
        return new PostgresStatement(query, client);
    }

    // ... other methods
}
```

### SQLite Adapter

```typescript
import { IDatabaseAdapter, IStatementAdapter, TableColumnInfo } from "@iamkirbki/database-handler-core";
import Database from "better-sqlite3";
import BetterSqlite3Statement from "./BetterSqlite3Statement.js";

export default class BetterSqlite3Adapter implements IDatabaseAdapter {
    private _db: Database.Database | null = null;

    async connect(databasePath: string): Promise<void> {
        this._db = new Database(databasePath);
    }

    async prepare(query: string): Promise<IStatementAdapter> {
        const stmt = this._db.prepare(query);
        return new BetterSqlite3Statement(stmt);
    }

    // ... other methods
}
```

---

## Usage

Once implemented, register your adapter with the Container:

```typescript
import Container from '@iamkirbki/database-handler-core';
import { MyDatabaseAdapter } from '@yourorg/database-handler-mydatabase';

const adapter = new MyDatabaseAdapter();
await adapter.connect(config);

const container = Container.getInstance();
container.registerAdapter('default', adapter, true);
```

---

## Parameter Conversion

**Important:** Convert `@paramName` syntax to your database's format:

| Database | Format | Example |
|----------|--------|---------|
| PostgreSQL | `$1, $2, $3` | `SELECT * FROM users WHERE id = $1` |
| MySQL | `?` | `SELECT * FROM users WHERE id = ?` |
| SQLite | `@paramName` or `?` | `SELECT * FROM users WHERE id = @id` |

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    const paramList: any[] = [];
    let index = 1;
    
    const convertedQuery = query.replace(/@(\w+)/g, (match, paramName) => {
        paramList.push(params[paramName]);
        return `$${index++}`; // PostgreSQL style
    });
    
    return [convertedQuery, paramList];
}
```

---

## See Also

- [IStatementAdapter](IStatementAdapter.md) - Statement execution interface
- [ISchemaBuilder](ISchemaBuilder.md) - Schema operations interface
- [PostgreSQL Adapter](../../../pg/README.md) - Reference implementation
- [SQLite Adapter](../../../bettersqlite3/README.md) - Reference implementation
