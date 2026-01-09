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

## Constructor

```typescript
constructor(TableName: string, Query: string)
```

**Parameters:**
- `TableName` (string): The name of the table being queried
- `Query` (string): The SQL query string with parameter placeholders

**Example:**
```typescript
const query = new Query('users', 'SELECT * FROM users WHERE age > :age');
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
public set Parameters(value: QueryCondition)
```

Get or set the query parameters. Parameters can be provided in two formats:

1. **Object format** (simple key-value pairs):
```typescript
query.Parameters = { age: 25, status: 'active' };
```

2. **Array format** (with operators):
```typescript
query.Parameters = [
  { column: 'age', operator: '>', value: 25 },
  { column: 'status', operator: '=', value: 'active' }
];
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
const query = new Query('users', 'UPDATE users SET status = :status WHERE id = :id');
query.Parameters = { id: 1, status: 'inactive' };
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

const query = new Query<User>('users', 'SELECT * FROM users WHERE age > :age');
query.Parameters = { age: 18 };
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

const query = new Query('users', 'SELECT * FROM users WHERE email = :email');
query.Parameters = { email: 'user@example.com' };
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
const query = new Query('users', 'SELECT COUNT(*) as count FROM users WHERE status = :status');
query.Parameters = { status: 'active' };
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

### Basic SELECT Query
```typescript
import { Query } from '@kirbkis/database-handler-core';

type Product = {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
};

const query = new Query('products', 'SELECT * FROM products WHERE price < :maxPrice');
query.Parameters = { maxPrice: 100 };
const affordableProducts = await query.All<Product>();
```

### Complex WHERE Conditions
```typescript
const query = new Query('orders', `
  SELECT * FROM orders 
  WHERE status = :status 
  AND created_at > :date
  ORDER BY created_at DESC
`);

query.Parameters = {
  status: 'pending',
  date: new Date('2026-01-01')
};

const recentOrders = await query.All();
```

### INSERT with Run
```typescript
const query = new Query('users', `
  INSERT INTO users (name, email, age) 
  VALUES (:name, :email, :age)
`);

query.Parameters = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
};

const result = await query.Run();
```

### UPDATE with Run
```typescript
const query = new Query('users', `
  UPDATE users 
  SET last_login = :lastLogin 
  WHERE id = :userId
`);

query.Parameters = {
  lastLogin: new Date(),
  userId: 42
};

await query.Run();
```

### DELETE with Run
```typescript
const query = new Query('sessions', `
  DELETE FROM sessions 
  WHERE expires_at < :now
`);

query.Parameters = { now: new Date() };
await query.Run();
```

### Using LIKE Operator
```typescript
const query = new Query('users', `
  SELECT * FROM users 
  WHERE name LIKE :pattern
`);

query.Parameters = { pattern: '%John%' };
const users = await query.All();
```

### Aggregate Functions
```typescript
// Sum
const sumQuery = new Query('orders', `
  SELECT SUM(total) as count 
  FROM orders 
  WHERE status = :status
`);
sumQuery.Parameters = { status: 'completed' };
const totalRevenue = await sumQuery.Count();

// Average
const avgQuery = new Query('products', `
  SELECT AVG(price) as count 
  FROM products 
  WHERE category = :category
`);
avgQuery.Parameters = { category: 'electronics' };
const avgPrice = await avgQuery.Count();
```

### JOIN Queries
```typescript
const query = new Query('users', `
  SELECT users.*, orders.total 
  FROM users 
  INNER JOIN orders ON users.id = orders.user_id 
  WHERE orders.status = :status
`);

query.Parameters = { status: 'completed' };
const usersWithOrders = await query.All();
```

## Best Practices

1. **Use Type Parameters**: Always specify types for type-safe results
   ```typescript
   const users = await query.All<User>(); // Type-safe
   ```

2. **Parameter Binding**: Always use parameter placeholders (`:paramName`) instead of string concatenation to prevent SQL injection
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
