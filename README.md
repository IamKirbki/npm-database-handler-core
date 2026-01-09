# @kirbkis/database-handler-core

Core abstractions and interfaces for the Kirbkis Database Handler library.

## Installation

```bash
npm install @iamkirbki/database-handler-core
```

> **Note:** You'll also need to install a database adapter:
> - `@iamkirbki/database-handler-better-sqlite3` for SQLite
> - `@iamkirbki/database-handler-pg` for PostgreSQL

## Overview

This package provides the core abstractions, interfaces, and base classes used by all database adapters. It includes:

- **Base Classes** - Query, Record, Table
- **Helpers** - QueryStatementBuilder for SQL generation
- **Abstract Classes** - Model, SchemaTableBuilder
- **Interfaces** - IDatabaseAdapter, ISchemaBuilder, IStatementAdapter
- **Runtime** - Container singleton for adapter management
- **Types** - TypeScript type definitions

## Core Components

### Base Classes

| Class | Description | Documentation |
|-------|-------------|---------------|
| `Query` | Execute raw SQL with parameter binding | [Query.md](src/base/Wiki/Query.md) |
| `Table` | High-level table interface | [Table.md](src/base/Wiki/Table.md) |
| `Record` | Single row with CRUD operations | [Record.md](src/base/Wiki/Record.md) |

### Helpers

| Helper | Description | Documentation |
|--------|-------------|---------------|
| `QueryStatementBuilder` | Build SQL queries programmatically | [QueryStatementBuilder.md](src/helpers/Wiki/QueryStatementBuilder.md) |

### Abstract Classes

| Class | Description | Documentation |
|-------|-------------|---------------|
| `Model` | Base model class | [Model.ts](src/abstract/Model.ts) |
| `SchemaTableBuilder` | Table schema builder | [SchemaTableBuilder.md](src/abstract/Wiki/SchemaTableBuilder.md) |

### Runtime

| Component | Description |
|-----------|-------------|
| `Container` | Singleton for managing database adapters |
| `Repository` | Base repository pattern implementation |

## Quick Start

### 1. Install Dependencies

```bash
npm install @iamkirbki/database-handler-core
npm install @iamkirbki/database-handler-pg  # or better-sqlite3
```

### 2. Setup Adapter

```typescript
import { Container } from '@iamkirbki/database-handler-core';
import { PostgresAdapter } from '@iamkirbki/database-handler-pg';

const db = new PostgresAdapter();
await db.connect({
    host: 'localhost',
    port: 5432,
    database: 'myapp'
});

Container.RegisterAdapter(db);
```

### 3. Use Core Classes

```typescript
import { Table, Record, Query } from '@iamkirbki/database-handler-core';

// Table interface
const usersTable = new Table('users');
const users = await usersTable.Records<User>();

// Record interface
const user = new Record<User>('users', { name: 'Alice' });
await user.Insert();

// Raw queries
const query = new Query({
    tableName: 'users',
    query: 'SELECT * FROM users WHERE age > @age',
    parameters: { age: 18 }
});
const results = await query.All<User>();
```

## Documentation

### Detailed Guides

- **[Query](src/base/Wiki/Query.md)** - Raw SQL queries with parameter binding
- **[Table](src/base/Wiki/Table.md)** - High-level table operations
- **[Record](src/base/Wiki/Record.md)** - Single row CRUD operations
- **[QueryStatementBuilder](src/helpers/Wiki/QueryStatementBuilder.md)** - Programmatic SQL building
- **[SchemaTableBuilder](src/abstract/Wiki/SchemaTableBuilder.md)** - Table schema definitions

### API Reference

#### Container

Singleton for managing database adapters:

```typescript
import { Container } from '@iamkirbki/database-handler-core';

// Register default adapter
Container.RegisterAdapter(dbAdapter);

// Register named adapter
Container.RegisterAdapter(analyticsAdapter, 'analytics');

// Get adapter
const adapter = Container.GetAdapter();
const namedAdapter = Container.GetAdapter('analytics');
```

#### Table

High-level interface for table operations:

```typescript
const table = new Table('users');

// Fetch records
const users = await table.Records<User>({ where: { status: 'active' } });

// Fetch single record
const user = await table.Record<User>({ where: { id: 1 } });

// Insert
await table.Insert({ name: 'Bob', email: 'bob@example.com' });

// Count
const count = await table.RecordsCount();

// JOIN
const results = await table.Join<User, Post>({
    joinTable: 'posts',
    joinType: 'INNER',
    on: 'users.id = posts.user_id'
});
```

#### Record

Single row with CRUD operations:

```typescript
// Create
const record = new Record<User>('users', { name: 'Alice' });
await record.Insert();

// Update
record.values.name = 'Alice Smith';
await record.Update();

// Delete
await record.Delete();        // Hard delete
await record.Delete(true);    // Soft delete
```

#### Query

Raw SQL query execution:

```typescript
const query = new Query({
    tableName: 'users',
    query: 'SELECT * FROM users WHERE age > @age',
    parameters: { age: 18 }
});

// Execute and get all results
const users = await query.All<User>();

// Get first result
const user = await query.Get<User>();

// Run INSERT/UPDATE/DELETE
await query.Run();

// Get count
const count = await query.Count();
```

#### QueryStatementBuilder

Build SQL programmatically:

```typescript
import QueryStatementBuilder from '@iamkirbki/database-handler-core/helpers/QueryStatementBuilder';

// SELECT
const sql = QueryStatementBuilder.BuildSelect('users', {
    where: { status: 'active' },
    orderBy: 'created_at DESC',
    limit: 10
});

// INSERT
const insertSql = QueryStatementBuilder.BuildInsert('users', {
    name: 'Alice',
    email: 'alice@example.com'
});

// UPDATE
const updateSql = QueryStatementBuilder.BuildUpdate('users',
    { name: 'Alice Smith' },
    { where: { id: 1 } }
);

// DELETE
const deleteSql = QueryStatementBuilder.BuildDelete('users', {
    where: { status: 'inactive' }
});
```

## Types

The package includes comprehensive TypeScript types:

```typescript
import type {
    columnType,
    QueryCondition,
    QueryParameters,
    DefaultQueryOptions,
    TableColumnInfo
} from '@iamkirbki/database-handler-core/types';
```

## Interfaces

### IDatabaseAdapter

Core interface that all database adapters must implement:

```typescript
interface IDatabaseAdapter {
    connect(config: any): Promise<void>;
    disconnect(): Promise<void>;
    execute(query: string, params?: any): Promise<any>;
    // ... more methods
}
```

### ISchemaBuilder

Interface for schema operations:

```typescript
interface ISchemaBuilder {
    createTable(name: string, callback: (table: SchemaTableBuilder) => void): Promise<void>;
    alterTable(oldName: string, callback: (table: SchemaTableBuilder) => void): Promise<void>;
    dropTable(name: string): Promise<void>;
}
```

### IStatementAdapter

Interface for statement execution:

```typescript
interface IStatementAdapter {
    execute(sql: string, params?: any): Promise<any>;
    query(sql: string, params?: any): Promise<any[]>;
}
```

## Advanced Usage

### Multiple Adapters

```typescript
// Register multiple database connections
Container.RegisterAdapter(mainDb, 'main', true);  // Default
Container.RegisterAdapter(analyticsDb, 'analytics');
Container.RegisterAdapter(cacheDb, 'cache');

// Use specific adapter
const table = new Table('events', 'analytics');
const events = await table.Records<Event>();
```

### Custom Models

Extend the base Model class:

```typescript
import { Model } from '@iamkirbki/database-handler-core';

class User extends Model<User> {
    tableName = 'users';
    
    async getFullName(): Promise<string> {
        return `${this.values.first_name} ${this.values.last_name}`;
    }
}
```

### Repository Pattern

```typescript
import { Repository } from '@iamkirbki/database-handler-core';

class UserRepository extends Repository<User> {
    constructor() {
        super('users');
    }
    
    async findActiveUsers(): Promise<User[]> {
        return this.find({ where: { status: 'active' } });
    }
}
```

## Parameter Binding

Always use `@paramName` syntax (both PostgreSQL and SQLite):

```typescript
// ✅ Correct
const query = new Query({
    query: 'SELECT * FROM users WHERE age > @age AND status = @status',
    parameters: { age: 18, status: 'active' }
});

// ❌ Wrong
const query = new Query({
    query: 'SELECT * FROM users WHERE age > :age',  // Won't work
});
```

## License

ISC License

## Links

- [Main Repository](https://github.com/iamkirbki/database-handler)
- [npm Package](https://www.npmjs.com/package/@iamkirbki/database-handler-core)
- [Documentation](https://github.com/iamkirbki/database-handler/tree/main/packages/core)
