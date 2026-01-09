# Interfaces

Core interfaces for creating database adapter packages.

---

## Overview

This directory contains the interfaces that define how database adapters integrate with the Kirbkis Database Handler. Implement these interfaces to add support for any database system.

---

## Interface Documentation

### [IDatabaseAdapter](Wiki/IDatabaseAdapter.md)
Core adapter interface for database connectivity, query preparation, and transaction management.

**Methods:**
- `connect(params)` - Establish database connection
- `prepare(query)` - Prepare SQL statements
- `exec(query)` - Execute DDL statements
- `transaction(fn)` - Handle transactions
- `tableColumnInformation(tableName)` - Retrieve table metadata
- `close()` - Close connection

### [IStatementAdapter](Wiki/IStatementAdapter.md)
Statement execution interface for parameter binding and result retrieval.

**Methods:**
- `run(parameters)` - Execute INSERT/UPDATE/DELETE
- `all(parameters)` - Fetch all rows
- `get(parameters)` - Fetch first row
- `runSync(parameters)` - Optional synchronous execution

### [ISchemaBuilder](Wiki/ISchemaBuilder.md)
Schema manipulation interface for creating and modifying table structures.

**Methods:**
- `createTable(name, callback)` - Create new table
- `dropTable(name)` - Delete table
- `alterTable(oldName, callback)` - Modify table structure

---

## Creating Custom Adapters

See the **[Custom Adapter Guide](Wiki/CustomAdapterGuide.md)** for complete step-by-step instructions on creating your own database adapter package.

**Topics covered:**
- Package structure and setup
- Implementing all three interfaces
- Parameter conversion patterns
- Testing and publishing
- Real-world examples

---

## Reference Implementations

Study these official adapters as examples:

- **[PostgreSQL Adapter](../../pg/README.md)** - Async operations, connection pooling
- **[SQLite Adapter](../../bettersqlite3/README.md)** - Sync + async operations

---

## Quick Example

```typescript
import { IDatabaseAdapter, IStatementAdapter } from '@iamkirbki/database-handler-core';

export default class MyAdapter implements IDatabaseAdapter {
    async connect(params: unknown): Promise<void> { /* ... */ }
    async prepare(query: string): Promise<IStatementAdapter> { /* ... */ }
    async exec(query: string): Promise<void> { /* ... */ }
    async transaction(fn: Function): Promise<Function> { /* ... */ }
    async tableColumnInformation(tableName: string): Promise<any[]> { /* ... */ }
    async close(): Promise<void> { /* ... */ }
}
```

See [Custom Adapter Guide](Wiki/CustomAdapterGuide.md) for full implementation details.
