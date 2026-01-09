# Query Builder

## Introduction

Build SQL queries programmatically with type-safe, structured methods.

```typescript
import { QueryStatementBuilder } from '@iamkirbki/database-handler-core';

const sql = QueryStatementBuilder.BuildSelect('users', {
  where: { status: 'active', role: 'admin' },
  orderBy: 'created_at DESC',
  limit: 10
});
// "SELECT * FROM "users" WHERE status = @status AND role = @role ORDER BY created_at DESC LIMIT 10"
```

## SELECT Queries

### Basic SELECT

```typescript
// All columns
QueryStatementBuilder.BuildSelect('users');
// "SELECT * FROM "users""

// Specific columns
QueryStatementBuilder.BuildSelect('users', {
  select: 'id, name, email'
});
// "SELECT id, name, email FROM "users""
```

### With WHERE

```typescript
// Object format
QueryStatementBuilder.BuildSelect('users', {
  where: { status: 'active', role: 'admin' }
});
// "SELECT * FROM "users" WHERE status = @status AND role = @role"

// Array format with operators
QueryStatementBuilder.BuildSelect('products', {
  where: [
    { column: 'price', operator: '<', value: 100 },
    { column: 'inStock', operator: '=', value: true }
  ]
});
// "SELECT * FROM "products" WHERE price < @price AND inStock = @inStock"
```

### With ORDER BY, LIMIT, OFFSET

```typescript
QueryStatementBuilder.BuildSelect('products', {
  where: { category: 'electronics' },
  orderBy: 'price DESC',
  limit: 20,
  offset: 40
});
// "SELECT * FROM "products" WHERE category = @category ORDER BY price DESC LIMIT 20 OFFSET 40"
```

## INSERT Queries

```typescript
QueryStatementBuilder.BuildInsert('users', {
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
});
// "INSERT INTO "users" (name, email, age) VALUES (@name, @email, @age)"
```

## UPDATE Queries

```typescript
QueryStatementBuilder.BuildUpdate('users', 
  { name: 'Alice Smith', email: 'alice.smith@example.com' },
  { where: { id: 1 } }
);
// "UPDATE "users" SET name = @name, email = @email WHERE id = @id"
```

## DELETE Queries

```typescript
QueryStatementBuilder.BuildDelete('users', {
  where: { status: 'inactive' }
});
// "DELETE FROM "users" WHERE status = @status"
```

## COUNT Queries

```typescript
QueryStatementBuilder.BuildCount('users', {
  where: { status: 'active' }
});
// "SELECT COUNT(*) as count FROM "users" WHERE status = @status"
```

## JOIN Queries

```typescript
QueryStatementBuilder.BuildJoin({
  mainTable: 'users',
  joinTable: 'posts',
  joinType: 'INNER',
  on: 'users.id = posts.user_id',
  select: 'users.*, posts.title, posts.created_at as post_date',
  where: { 'posts.status': 'published' },
  orderBy: 'posts.created_at DESC'
});
// "SELECT users.*, posts.title, posts.created_at as post_date FROM "users" INNER JOIN "posts" ON users.id = posts.user_id WHERE posts.status = @posts.status ORDER BY posts.created_at DESC"
```

### JOIN Types

```typescript
// INNER JOIN
QueryStatementBuilder.BuildJoin({
  mainTable: 'users',
  joinTable: 'posts',
  joinType: 'INNER',
  on: 'users.id = posts.user_id'
});

// LEFT JOIN
QueryStatementBuilder.BuildJoin({
  mainTable: 'users',
  joinTable: 'profiles',
  joinType: 'LEFT',
  on: 'users.id = profiles.user_id'
});

// RIGHT JOIN
QueryStatementBuilder.BuildJoin({
  mainTable: 'users',
  joinTable: 'orders',
  joinType: 'RIGHT',
  on: 'users.id = orders.user_id'
});

// FULL JOIN
QueryStatementBuilder.BuildJoin({
  mainTable: 'users',
  joinTable: 'sessions',
  joinType: 'FULL',
  on: 'users.id = sessions.user_id'
});
```

## Helper Methods

### BuildWhere()

Generate WHERE clause from conditions.

```typescript
QueryStatementBuilder.BuildWhere({ status: 'active', role: 'admin' });
// "WHERE status = @status AND role = @role"

QueryStatementBuilder.BuildWhere([
  { column: 'age', operator: '>', value: 18 },
  { column: 'status', operator: '=', value: 'active' }
]);
// "WHERE age > @age AND status = @status"
```

### BuildQueryOptions()

Generate ORDER BY, LIMIT, OFFSET clauses.

```typescript
QueryStatementBuilder.BuildQueryOptions({
  orderBy: 'created_at DESC',
  limit: 10,
  offset: 20
});
// "ORDER BY created_at DESC LIMIT 10 OFFSET 20"
```

## Integration with Query Class

```typescript
import { Query } from '@kirbkis/database-handler-core';
import QueryStatementBuilder from '@kirbkis/database-handler-core/helpers/QueryStatementBuilder';

// Build the SQL
const sql = QueryStatementBuilder.BuildSelect('users', {
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10
});

// Execute with Query class
const query = new Query({
  tableName: 'users',
  query: sql,
  parameters: { status: 'active' }
});

const users = await query.All<User>();
```

## Examples

### Dynamic Search

```typescript
function buildSearchQuery(filters: any) {
  const where: any[] = [];
  
  if (filters.name) {
    where.push({ column: 'name', operator: 'LIKE', value: `%${filters.name}%` });
  }
  
  if (filters.minAge) {
    where.push({ column: 'age', operator: '>=', value: filters.minAge });
  }
  
  if (filters.status) {
    where.push({ column: 'status', operator: '=', value: filters.status });
  }
  
  return QueryStatementBuilder.BuildSelect('users', {
    where,
    orderBy: filters.sortBy || 'created_at DESC',
    limit: filters.limit || 20,
    offset: filters.offset || 0
  });
}
```

### Bulk Operations

```typescript
// Generate multiple INSERT statements
const users = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
];

users.forEach(user => {
  const sql = QueryStatementBuilder.BuildInsert('users', user);
  // Execute each INSERT
});
```

### Complex Filtering

```typescript
const sql = QueryStatementBuilder.BuildSelect('orders', {
  where: [
    { column: 'total', operator: '>', value: 100 },
    { column: 'status', operator: 'IN', value: ['pending', 'processing'] },
    { column: 'created_at', operator: '>=', value: '2026-01-01' }
  ],
  orderBy: 'total DESC',
  limit: 50
});
```
