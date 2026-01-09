# Query

## Introduction

Execute raw SQL queries with parameter binding and automatic result mapping to Record objects.

> **Note:** Use `@paramName` for parameter placeholders (e.g., `@age`, `@email`). Both BetterSQLite3 and PostgreSQL adapters use this syntax.

```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE age > @age', 
  parameters: { age: 25 } 
});

const users = await query.All<User>();
```

## Creating Queries

```typescript
// Basic query
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE status = @status',
  parameters: { status: 'active' }
});

// No parameters
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users' 
});

// Named adapter
const query = new Query({ 
  tableName: 'events',
  query: 'SELECT * FROM events WHERE date > @date',
  parameters: { date: '2024-01-01' },
  adapterName: 'analytics'
});
```

### Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tableName` | string | Table name for this query |
| `query` | string | SQL query with `@param` placeholders |
| `parameters` | object/array | Parameter values (optional) |
| `adapterName` | string | Named adapter to use (optional) |

## Parameter Formats

### Object Format

```typescript
parameters: { age: 25, status: 'active' }
```

### Array Format

```typescript
parameters: [
  { column: 'age', operator: '>', value: 25 },
  { column: 'status', operator: '=', value: 'active' }
]
```

## Execution Methods

### Run()

Execute INSERT, UPDATE, or DELETE queries. Returns database adapter result.

```typescript
const query = new Query({ 
  tableName: 'users',
  query: 'INSERT INTO users (name, email) VALUES (@name, @email)',
  parameters: { name: 'Alice', email: 'alice@example.com' }
});

await query.Run();
// Returns: { lastInsertRowid: 1, changes: 1 }
```

### All()

Execute SELECT queries and return all matching rows as Record objects.

```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE age > @age', 
  parameters: { age: 18 } 
});

const users = await query.All<User>();
// Returns: Array of Record<User> objects
```

### Get()

Execute SELECT query and return only the first row as a Record object.

```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT * FROM users WHERE email = @email', 
  parameters: { email: 'user@example.com' } 
});

const user = await query.Get<User>();
// Returns: Record<User> | undefined
```

### Count()

Execute COUNT query and return the numeric result.

```typescript
const query = new Query({ 
  tableName: 'users', 
  query: 'SELECT COUNT(*) as count FROM users WHERE status = @status', 
  parameters: { status: 'active' } 
});

const count = await query.Count();
// Returns: number
```

## Static Methods

```typescript
// Get table column information
const columns = await Query.tableColumnInformation('users');

// Convert parameters between formats
const arrayParams = Query.ConvertParamsToArray({ age: 25, status: 'active' });
const objParams = Query.ConvertParamsToObject([
  { column: 'age', operator: '=', value: 25 }
]);
```

## Examples

### Complex WHERE Conditions

```typescript
const query = new Query({ 
  tableName: 'orders',
  query: `SELECT * FROM orders 
          WHERE status = @status AND created_at > @date
          ORDER BY created_at DESC`,
  parameters: { status: 'pending', date: '2026-01-01' }
});

const orders = await query.All();
```

### UPDATE Query

```typescript
const query = new Query({ 
  tableName: 'users',
  query: 'UPDATE users SET last_login = @now WHERE id = @userId',
  parameters: { now: new Date(), userId: 42 }
});

await query.Run();
```

### LIKE Operator

```typescript
const query = new Query({ 
  tableName: 'users',
  query: 'SELECT * FROM users WHERE name LIKE @pattern',
  parameters: { pattern: '%John%' }
});

const users = await query.All();
```

### JOIN Query

```typescript
const query = new Query({ 
  tableName: 'users',
  query: `SELECT users.*, orders.total 
          FROM users 
          INNER JOIN orders ON users.id = orders.user_id 
          WHERE orders.status = @status`,
  parameters: { status: 'completed' }
});

const results = await query.All();
```

### Aggregate Functions

```typescript
// Sum
const sumQuery = new Query({ 
  tableName: 'orders',
  query: 'SELECT SUM(total) as count FROM orders WHERE status = @status',
  parameters: { status: 'completed' }
});
const total = await sumQuery.Count();

// Average
const avgQuery = new Query({ 
  tableName: 'products',
  query: 'SELECT AVG(price) as count FROM products',
});
const avgPrice = await avgQuery.Count();
```
