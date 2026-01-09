# @kirbkis/database-handler-core

Core abstractions and interfaces for the Kirbkis Database Handler library.

## Table of Contents

- [Installation](#installation)
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [API Reference](#api-reference)
- [Types](#types)
- [Interfaces](#interfaces)
- [Advanced Usage](#advanced-usage)
- [Parameter Binding](#parameter-binding)
- [License](#license)
- [Links](#links)

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

---

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
//Connect with poolconfig for pg and filepath for sqlite
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

// Table instance
const usersTable = new Table('users');
const users = await usersTable.Records<User>();

// Record instance
const user = new Record<User>('users', { name: 'Alice' });
await user.Insert();

// Update record (requires newValues and primaryKey)
await user.Update({ name: 'Alice Smith' }, { id: user.values.id });

// Raw queries
const query = new Query({
    tableName: 'users',
    query: 'SELECT * FROM users WHERE age > @age',
    parameters: { age: 18 }
});
const results = await query.All<User>();
```

---

## Documentation

### Detailed Guides

- **[Query](src/base/Wiki/Query.md)** - Raw SQL queries with parameter binding
- **[Table](src/base/Wiki/Table.md)** - High-level table operations
- **[Record](src/base/Wiki/Record.md)** - Single row CRUD operations
- **[QueryStatementBuilder](src/helpers/Wiki/QueryStatementBuilder.md)** - Programmatic SQL building
- **[SchemaTableBuilder](src/abstract/Wiki/SchemaTableBuilder.md)** - Table schema definitions

---

## API Reference

### [Container](src/runtime/Wiki/Container.md)

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



#### [Table](src/base/Wiki/Table.md)

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
const results = await table.Join<User>({
    fromTable: 'posts',
    joinType: 'INNER',
    on: 'users.id = posts.user_id'
});
```



#### [Record](src/base/Wiki/Record.md)

Single row with CRUD operations:

```typescript
// Create
const record = new Record<User>('users', { name: 'Alice' });
await record.Insert();

// Delete (requires primaryKey parameter)
await record.Delete({ id: 1 });  // Soft delete if deleted_at column exists, otherwise hard delete
```



#### [Query](src/base/Wiki/Query.md)

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



#### [QueryStatementBuilder](src/helpers/Wiki/QueryStatementBuilder.md)

Build SQL programmatically:

```typescript
import { QueryStatementBuilder } from '@iamkirbki/database-handler-core';

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

---

## Interfaces

See [Interfaces Documentation](src/interfaces/README.md) for complete guide.

### [IDatabaseAdapter](src/interfaces/Wiki/IDatabaseAdapter.md)

Core interface that all database adapters must implement:

```typescript
interface IDatabaseAdapter {
    connect(config: any): Promise<void>;
    disconnect(): Promise<void>;
    execute(query: string, params?: any): Promise<any>;
    // ... more methods if needed
}
```

### [ISchemaBuilder](src/interfaces/Wiki/ISchemaBuilder.md)

Interface for schema operations:

```typescript
interface ISchemaBuilder {
    createTable(name: string, callback: (table: SchemaTableBuilder) => void): Promise<void>;
    alterTable(oldName: string, callback: (table: SchemaTableBuilder) => void): Promise<void>;
    dropTable(name: string): Promise<void>;
}
```

### [IStatementAdapter](src/interfaces/Wiki/IStatementAdapter.md)

Interface for statement execution:

```typescript
interface IStatementAdapter {
    execute(sql: string, params?: any): Promise<any>;
    query(sql: string, params?: any): Promise<any[]>;
}
```

---

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

Extend the Model class (see [Model](src/abstract/Wiki/Model.md)):

```typescript
import { Model } from '@iamkirbki/database-handler-core';

type UserData = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
};

class User extends Model<UserData> {
    protected tableName = 'users';
    
    // Custom instance method
    getFullName(): string {
        return `${this.values.first_name} ${this.values.last_name}`;
    }
    
    // Custom static method
    static async findByEmail(email: string): Promise<User | undefined> {
        return await this.findOne({ where: { email } });
    }
}

// Use static methods to find records
const user = await User.find(1).first();
if (user) {
    console.log(user.getFullName()); // "John Doe"
    user.values.first_name = 'Jane';
    await user.save();
}

const alice = await User.findByEmail('alice@example.com');

// Create new record with static method
const newUser = await User.set({
    first_name: 'Bob',
    last_name: 'Smith',
    email: 'bob@example.com'
}).save();

// Or create instance first, then use methods and save
const charlie = new User();
charlie.set({
    first_name: 'Charlie',
    last_name: 'Brown',
    email: 'charlie@example.com'
});
console.log(charlie.getFullName()); // "Charlie Brown"
await charlie.save(); // Insert into database
```

---

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
