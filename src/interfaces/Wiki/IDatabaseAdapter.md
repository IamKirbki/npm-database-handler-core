# IDatabaseAdapter

Core interface for database connectivity and operations.

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
await adapter.connect({ host: 'localhost', database: 'myapp' });
```

---

### `prepare(query)`

Prepare a SQL query for execution. Must convert `@paramName` syntax to database-specific format.

**Parameters:**
- `query` (string) - SQL query with `@paramName` parameters

**Returns:** `Promise<IStatementAdapter>`

**Example:**
```typescript
const stmt = await adapter.prepare('SELECT * FROM users WHERE id = @id');
const user = await stmt.get({ id: 1 });
```

---

### `exec(query)`

Execute DDL statements without returning results.

**Parameters:**
- `query` (string) - SQL query string

**Returns:** `Promise<void>`

**Example:**
```typescript
await adapter.exec('CREATE TABLE users (id INT PRIMARY KEY, name TEXT)');
```

---

### `transaction(fn)`

Execute operations within a transaction. Return commit function.

**Parameters:**
- `fn` ((items: any[]) => void) - Transaction operations

**Returns:** `Promise<Function>` - Commit function

**Example:**
```typescript
const commit = await adapter.transaction(() => {
    // Operations here
});
await commit();
```

---

### `tableColumnInformation(tableName)`

Retrieve column metadata for a table.

**Parameters:**
- `tableName` (string) - Table name

**Returns:** `Promise<TableColumnInfo[]>`

**TableColumnInfo:**
```typescript
type TableColumnInfo = {
    cid: number;               // Column position
    name: string;              // Column name
    type: string;              // Data type
    notnull: number;           // 1 = NOT NULL, 0 = nullable
    dflt_value: string | null; // Default value
    pk: number;                // 1 = primary key, 0 = not
};
```

---

### `close()`

Close database connection and cleanup resources.

**Returns:** `Promise<void>`

---

## Usage

Register adapter with Container:

```typescript
import Container from '@iamkirbki/database-handler-core';
import { MyDatabaseAdapter } from '@yourorg/database-handler-mydatabase';

const adapter = new MyDatabaseAdapter();
await adapter.connect(config);

Container.getInstance().registerAdapter('default', adapter, true);
```

---

## Creating Custom Adapters

See **[Custom Adapter Guide](CustomAdapterGuide.md)** for complete implementation details.

**Quick reference:**
- Convert `@paramName` to your database's parameter format (`?`, `$1`, etc.)
- Query information schema for `tableColumnInformation()`
- Wrap statement objects with IStatementAdapter implementation
- Handle transactions with begin/commit/rollback

---

## See Also

- [Custom Adapter Guide](CustomAdapterGuide.md) - Full implementation guide
- [IStatementAdapter](IStatementAdapter.md) - Statement execution interface
- [ISchemaBuilder](ISchemaBuilder.md) - Schema operations interface
- [PostgreSQL Adapter](../../../pg/README.md) - Reference implementation
- [SQLite Adapter](../../../bettersqlite3/README.md) - Reference implementation
