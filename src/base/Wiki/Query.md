# Query Class Documentation

The `Query` class provides a flexible interface for executing custom SQL queries with parameter binding and automatic result mapping.

## Table of Contents
- [Overview](#overview)
- [Constructor](#constructor)
- [Properties](#properties)
- [Methods](#methods)
  - [Run](#run)
  - [All](#all)
  - [Get](#get)
  - [Count](#count)
- [Static Methods](#static-methods)
- [Usage Examples](#usage-examples)

## Overview

The Query class allows you to execute raw SQL queries while maintaining type safety and automatic conversion to Record objects. It handles parameter binding and provides different execution methods depending on your needs (run, get, all).

**Parameter Placeholders:** Both the BetterSQLite3 and PostgreSQL adapters use `@paramName` syntax for parameter placeholders (e.g., `@age`, `@email`). This differs from some other SQL libraries that use `:paramName` or `?` placeholders. Using `:paramName` will cause errors.

**Alternative Approach:** For most common database operations, consider using [QueryStatementBuilder](../../helpers/Wiki/QueryStatementBuilder.md) which provides a type-safe way to build SQL queries without writing raw SQL strings.

## Constructor

```typescript
constructor({ tableName, query, parameters, adapterName }: {
  tableName: string;
  query: string;
  parameters?: QueryCondition;
  adapterName?: string;
})
```

**Parameters (object):**
- `tableName` (string): The name of the table being queried
- `query` (string): The SQL query string with parameter placeholders
- `parameters` (optional, QueryCondition): Parameter values to bind to the query placeholders
- `adapterName` (optional, string): Name of a specific adapter to use (defaults to the default adapter registered in Container)

**Example:**
```typescript
// With parameters
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE age > @age', 
  parameters: { age: 25 } 
});

// Without parameters (for queries with no placeholders)
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users' 
});

// With custom adapter
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE status = @status',
  parameters: { status: 'active' },
  adapterName: 'analytics' // Use a named adapter
});
```

## Properties

### TableName
```typescript
public readonly TableName: string
```
The name of the table associated with this query (read-only).

### Parameters
```typescript
public get Parameters(): QueryCondition
```

Get the query parameters (read-only). Parameters must be set via the constructor.

Parameters can be provided in two formats:

1. **Object format** (simple key-value pairs):
```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE status = @status', 
  parameters: { age: 25, status: 'active' }
});
```

2. **Array format** (with operators):
```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE age > @age',
  parameters: [
    { column: 'age', operator: '>', value: 25 },
    { column: 'status', operator: '=', value: 'active' }
  ]
});
```

**Supported operators:** `=`, `!=`, `<`, `<=`, `>`, `>=`, `LIKE`, `IN`, `NOT IN`

## Methods

### Run
```typescript
public async Run<Type>(): Promise<Type>
```

Executes a non-SELECT query (INSERT, UPDATE, DELETE, etc.) and returns the result.

**Returns:** A promise that resolves to the execution result (type varies by database adapter).

**Use cases:**
- INSERT operations
- UPDATE operations
- DELETE operations
- DDL statements (CREATE, ALTER, DROP)

**Example:**
```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'UPDATE users SET status = @status WHERE id = @id', 
  parameters: { id: 1, status: 'inactive' }
});
const result = await query.Run();
```

### All
```typescript
public async All<Type extends columnType>(): Promise<Record<Type>[]>
```

Executes a SELECT query and returns all matching rows as an array of Record objects.

**Type Parameter:**
- `Type`: The shape of your data object

**Returns:** A promise that resolves to an array of `Record<Type>` objects.

**Example:**
```typescript
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE age > @age', 
  parameters: { age: 18 } 
});
const users = await query.All<User>();

// Access records
users.forEach(user => {
  console.log(user.name); // Type-safe access
});
```

### Get
```typescript
public async Get<Type extends columnType>(): Promise<Record<Type> | undefined>
```

Executes a SELECT query and returns only the first matching row as a Record object.

**Type Parameter:**
- `Type`: The shape of your data object

**Returns:** A promise that resolves to a `Record<Type>` object or `undefined` if no match found.

**Example:**
```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE email = @email', 
  parameters: { email: 'user@example.com' } 
});
const user = await query.Get<User>();

if (user) {
  console.log(user.name);
}
```

### Count
```typescript
public async Count(): Promise<number>
```

Executes a COUNT query and returns the numeric result.

**Returns:** A promise that resolves to the count as a number.

**Example:**
```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT COUNT(*) as count FROM users WHERE status = @status', 
  parameters: { status: 'active' } 
});
const activeUserCount = await query.Count();
console.log(`Active users: ${activeUserCount}`);
```

## Static Methods

### tableColumnInformation
```typescript
public static async tableColumnInformation(tableName: string): Promise<TableColumnInfo[]>
```

Retrieves column information for a specific table.

**Parameters:**
- `tableName` (string): The name of the table

**Returns:** A promise that resolves to an array of `TableColumnInfo` objects.

**Example:**
```typescript
const columns = await Query.tableColumnInformation('users');
columns.forEach(col => {
  console.log(`${col.name}: ${col.type}`);
});
```

### ConvertParamsToArray
```typescript
public static ConvertParamsToArray(params: QueryCondition): QueryParameters[]
```

Converts parameters from object format to array format.

**Example:**
```typescript
const objParams = { age: 25, status: 'active' };
const arrayParams = Query.ConvertParamsToArray(objParams);
// Result: [
//   { column: 'age', operator: '=', value: 25 },
//   { column: 'status', operator: '=', value: 'active' }
// ]
```

### ConvertParamsToObject
```typescript
public static ConvertParamsToObject(params: QueryCondition): QueryWhereParameters
```

Converts parameters from array format to object format.

**Example:**
```typescript
const arrayParams = [
  { column: 'age', operator: '=', value: 25 },
  { column: 'status', operator: '=', value: 'active' }
];
const objParams = Query.ConvertParamsToObject(arrayParams);
// Result: { age: '25', status: 'active' }
```

## Usage Examples

### Using Custom Adapters

If you have multiple database connections registered in the Container, you can specify which adapter to use for a specific query:

```typescript
import { Container } from '@kirbkis/database-handler-core';
import { PostgresAdapter } from '@kirbkis/database-handler-pg';
import { BetterSqlite3Adapter } from '@kirbkis/database-handler-better-sqlite3';

// Register multiple adapters
const container = Container.getInstance();
const mainDb = new PostgresAdapter();
const analyticsDb = new BetterSqlite3Adapter();

mainDb.connect(pgConfig);
analyticsDb.connect('./analytics.db');

container.registerAdapter('postgres', mainDb, true); // Default adapter
container.registerAdapter('analytics', analyticsDb);

// Query using default adapter (postgres)
const mainQuery = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE status = @status',
  parameters: { status: 'active' }
});
const users = await mainQuery.All<User>();

// Query using analytics adapter
const analyticsQuery = new Query({ 
  tableName: 'events', 
  query: 'SELECT * FROM events WHERE date > @date',
  parameters: { date: '2026-01-01' },
  adapterName: 'analytics' // Specify adapter name
});
const events = await analyticsQuery.All();
```

### Basic SELECT Query
```typescript
import { Query } from '@kirbkis/database-handler-core';

type Product = {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
};

const query = new Query('products', 'SELECT * FROM products WHERE price < @maxPrice');
query.Parameters = { maxPrice: 100 };
const affordableProducts = await query.All<Product>();
// Returns: Array of Record<Product> objects where price < 100
// Example: [Record<Product>, Record<Product>, ...] with properties: id, name, price, inStock
```

### Complex WHERE Conditions
```typescript
const query = new Query({ 
  tableName: 'orders',
  query: `
    SELECT * FROM orders 
    WHERE status = @status 
    AND created_at > @date
    ORDER BY created_at DESC
  `,
  parameters: {
    status: 'pending',
    date: new Date('2026-01-01')
  }
});

const recentOrders = await query.All();
// Returns: Array of Record objects with all orders that are pending and created after Jan 1, 2026
// Sorted by created_at in descending order
```

### INSERT with Run
```typescript
const query = new Query({ 
  tableName: 'users',
  query: `
    INSERT INTO users (name, email, age) 
    VALUES (@name, @email, @age)
  `,
  parameters: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  }
});

const result = await query.Run();
// Returns: Database adapter result (e.g., { lastInsertRowid: 1, changes: 1 })
```

### UPDATE with Run
```typescript
const query = new Query({ 
  tableName: 'users',
  query: `
    UPDATE users 
    SET last_login = @lastLogin 
    WHERE id = @userId
  `,
  parameters: {
    lastLogin: new Date(),
    userId: 42
  }
});

const result = await query.Run();
// Returns: Database adapter result (e.g., { changes: 1 })
// Indicates 1 row was updated
```

### DELETE with Run
```typescript
const query = new Query({ 
  tableName: 'sessions',
  query: `
    DELETE FROM sessions 
    WHERE expires_at < @now
  `,
  parameters: { now: new Date() }
});
const result = await query.Run();
// Returns: Database adapter result (e.g., { changes: 5 })
// Indicates 5 expired sessions were deleted
```

### Using LIKE Operator
```typescript
const query = new Query({ 
  tableName: 'users',
  query: `
    SELECT * FROM users 
    WHERE name LIKE @pattern
  `,
  parameters: { pattern: '%John%' }
});
const users = await query.All();
// Returns: Array of Record objects for all users with 'John' in their name
// Example: [Record{ id: 1, name: 'John Doe' }, Record{ id: 5, name: 'Johnny Smith' }]
```

### Aggregate Functions
```typescript
// Sum
const sumQuery = new Query({ 
  tableName: 'orders',
  query: `
    SELECT SUM(total) as count 
    FROM orders 
    WHERE status = @status
  `,
  parameters: { status: 'completed' }
});
const totalRevenue = await sumQuery.Count();

// Average
const avgQuery = new Query({ 
  tableName: 'products',
  query: `
    SELECT AVG(price) as count 
    FROM products 
    WHERE category = @category
  `,
  parameters: { category: 'electronics' }
});
const avgPrice = await avgQuery.Count();
// Returns: Average price as a number (e.g., 549)
```

### JOIN Queries
```typescript
const query = new Query({ 
  tableName: 'users',
  query: `
    SELECT users.*, orders.total 
    FROM users 
    INNER JOIN orders ON users.id = orders.user_id 
    WHERE orders.status = @status
  `,
  parameters: { status: 'completed' }
});
const usersWithOrders = await query.All();
// Returns: Array of Record objects with joined data from users and orders tables
// Example: [Record{ id: 1, name: 'Alice', email: 'alice@...', total: 99.99 }, ...]
```

## Best Practices

1. **Use Type Parameters**: Always specify types for type-safe results
   ```typescript
   const users = await query.All<User>(); // Type-safe
   ```

2. **Parameter Binding**: Always use parameter placeholders (`@paramName`) instead of string concatenation to prevent SQL injection
   ```typescript
   // Good
   query.Parameters = { email: userInput };
   
   // Bad - vulnerable to SQL injection
   const query = new Query('users', `SELECT * FROM users WHERE email = '${userInput}'`);
   ```

3. **Choose the Right Method**:
   - Use `All()` when you expect multiple rows
   - Use `Get()` when you expect a single row or want the first result
   - Use `Run()` for INSERT, UPDATE, DELETE operations
   - Use `Count()` for aggregate functions that return a single number

4. **Handle Undefined Results**: When using `Get()`, always check for undefined
   ```typescript
   const user = await query.Get<User>();
   if (user) {
     // User found
   } else {
     // No user found
   }
   ```

5. **Table Name Consistency**: Ensure the table name passed to the constructor matches the actual table in your query for proper Record creation

## Notes

- All values are automatically converted to strings for database compatibility (except `null`, `undefined`, and `Date` objects)
- The Query class uses the database adapter configured in the Container singleton
- Results are automatically wrapped in Record objects, providing additional utility methods
- **Custom Adapters**: Use the `adapterName` parameter to query different databases when you have multiple adapters registered. If omitted, the default adapter is used.
