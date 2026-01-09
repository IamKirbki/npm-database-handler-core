# QueryStatementBuilder Class Documentation

The `QueryStatementBuilder` class is a utility for building SQL query strings in a type-safe and structured way. It eliminates the need to write raw SQL strings by hand while maintaining full control over query structure.

## Table of Contents
- [Overview](#overview)
- [When to Use](#when-to-use)
- [Methods](#methods)
  - [BuildSelect](#buildselect)
  - [BuildInsert](#buildinsert)
  - [BuildUpdate](#buildupdate)
  - [BuildDelete](#builddelete)
  - [BuildCount](#buildcount)
  - [BuildJoin](#buildjoin)
  - [BuildWhere](#buildwhere)
  - [BuildQueryOptions](#buildqueryoptions)
- [Usage Examples](#usage-examples)
- [Integration with Query Class](#integration-with-query-class)

## Overview

QueryStatementBuilder provides static methods for building common SQL operations (SELECT, INSERT, UPDATE, DELETE, COUNT) with support for:
- WHERE clauses with multiple conditions
- ORDER BY, LIMIT, and OFFSET
- JOIN operations (INNER, LEFT, RIGHT, FULL)
- Parameter placeholders using `@paramName` syntax
- Type-safe query construction

All methods return SQL strings with `@paramName` parameter placeholders that work seamlessly with the Query class and PostgreSQL adapter.

## When to Use

**Use QueryStatementBuilder when:**
- Building dynamic queries programmatically
- You want type safety and autocomplete for query building
- Constructing complex queries with conditional WHERE clauses
- Building queries with JOIN operations
- You prefer a structured approach over raw SQL strings

**Use Query class directly when:**
- Writing complex, specialized queries that don't fit the builder pattern
- Using advanced SQL features not covered by the builder
- Working with existing SQL query strings

## Methods

### BuildSelect

```typescript
public static BuildSelect(
  tableName: string, 
  options?: DefaultQueryOptions & QueryOptions
): string
```

Builds a SELECT statement with optional filtering, ordering, and pagination.

**Parameters:**
- `tableName` (string): The table to select from
- `options` (optional):
  - `select` (string): Columns to select (default: `*`)
  - `where` (QueryCondition): WHERE conditions
  - `orderBy` (string): ORDER BY clause
  - `limit` (number): Maximum rows to return
  - `offset` (number): Number of rows to skip

**Returns:** Complete SELECT SQL statement string

**Examples:**
```typescript
import QueryStatementBuilder from '@kirbkis/database-handler-core/helpers/QueryStatementBuilder';

// Select all columns
const query = QueryStatementBuilder.BuildSelect('users');
// "SELECT * FROM "users""

// Select specific columns
const query = QueryStatementBuilder.BuildSelect('users', {
  select: 'id, name, email'
});
// "SELECT id, name, email FROM "users""

// With WHERE clause
const query = QueryStatementBuilder.BuildSelect('users', {
  where: { status: 'active', role: 'admin' }
});
// "SELECT * FROM "users" WHERE status = @status AND role = @role"

// Full query with all options
const query = QueryStatementBuilder.BuildSelect('products', {
  select: 'id, name, price',
  where: { category: 'electronics', inStock: true },
  orderBy: 'price DESC',
  limit: 20,
  offset: 40
});
// "SELECT id, name, price FROM "products" WHERE category = @category AND inStock = @inStock ORDER BY price DESC LIMIT 20 OFFSET 40"

// Array format WHERE with operators
const query = QueryStatementBuilder.BuildSelect('users', {
  where: [
    { column: 'age', operator: '>', value: 18 },
    { column: 'status', operator: '=', value: 'active' }
  ]
});
// "SELECT * FROM "users" WHERE age > @age AND status = @status"
```

### BuildInsert

```typescript
public static BuildInsert(
  tableName: string, 
  record: QueryWhereParameters
): string
```

Builds an INSERT statement with named parameter placeholders.

**Parameters:**
- `tableName` (string): The table to insert into
- `record` (object): Column names and placeholder values

**Returns:** Complete INSERT SQL statement string

**Examples:**
```typescript
// Simple insert
const query = QueryStatementBuilder.BuildInsert('users', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});
// "INSERT INTO "users" ("name", "email", "age") VALUES (@name, @email, @age)"

// Insert with additional fields
const query = QueryStatementBuilder.BuildInsert('products', {
  name: 'Laptop',
  price: 999.99,
  category: 'electronics',
  inStock: true,
  createdAt: new Date()
});
// "INSERT INTO "products" ("name", "price", "category", "inStock", "createdAt") VALUES (@name, @price, @category, @inStock, @createdAt)"
```

### BuildUpdate

```typescript
public static BuildUpdate(
  tableName: string, 
  record: QueryCondition, 
  where: QueryCondition
): string
```

Builds an UPDATE statement with SET clause and WHERE conditions.

**Parameters:**
- `tableName` (string): The table to update
- `record` (object): Columns to update with their placeholder values
- `where` (QueryCondition): WHERE conditions for targeting specific rows

**Returns:** Complete UPDATE SQL statement string

**Note:** WHERE parameter placeholders are prefixed with `where_` to avoid conflicts with SET values.

**Examples:**
```typescript
// Simple update
const query = QueryStatementBuilder.BuildUpdate(
  'users',
  { name: 'Jane Doe', age: 31 },
  { id: 1 }
);
// "UPDATE "users" SET name = @name, age = @age WHERE id = @where_id"

// Update with multiple WHERE conditions
const query = QueryStatementBuilder.BuildUpdate(
  'products',
  { price: 899.99, inStock: true },
  { category: 'electronics', status: 'active' }
);
// "UPDATE "products" SET price = @price, inStock = @inStock WHERE category = @where_category AND status = @where_status"

// Update single field
const query = QueryStatementBuilder.BuildUpdate(
  'users',
  { lastLogin: new Date() },
  { email: 'user@example.com' }
);
// "UPDATE "users" SET lastLogin = @lastLogin WHERE email = @where_email"
```

### BuildDelete

```typescript
public static BuildDelete(
  tableName: string, 
  where: QueryCondition
): string
```

Builds a DELETE statement with WHERE conditions.

**Parameters:**
- `tableName` (string): The table to delete from
- `where` (QueryCondition): WHERE conditions for targeting specific rows

**Returns:** Complete DELETE SQL statement string

**Examples:**
```typescript
// Delete by ID
const query = QueryStatementBuilder.BuildDelete('users', { id: 1 });
// "DELETE FROM "users" WHERE id = @id"

// Delete with multiple conditions
const query = QueryStatementBuilder.BuildDelete('sessions', {
  status: 'expired',
  lastActive: '2025-01-01'
});
// "DELETE FROM "sessions" WHERE status = @status AND lastActive = @lastActive"

// Delete archived records
const query = QueryStatementBuilder.BuildDelete('logs', {
  archived: true,
  createdAt: '2024-01-01'
});
// "DELETE FROM "logs" WHERE archived = @archived AND createdAt = @createdAt"
```

### BuildCount

```typescript
public static BuildCount(
  tableName: string, 
  where?: QueryCondition
): string
```

Builds a COUNT statement to count rows, optionally with WHERE conditions.

**Parameters:**
- `tableName` (string): The table to count rows from
- `where` (optional, QueryCondition): WHERE conditions to filter counted rows

**Returns:** Complete COUNT SQL statement string

**Examples:**
```typescript
// Count all rows
const query = QueryStatementBuilder.BuildCount('users');
// "SELECT COUNT(*) as count FROM "users""

// Count with conditions
const query = QueryStatementBuilder.BuildCount('users', {
  status: 'active',
  role: 'admin'
});
// "SELECT COUNT(*) as count FROM "users" WHERE status = @status AND role = @role"

// Count with operator conditions
const query = QueryStatementBuilder.BuildCount('products', [
  { column: 'price', operator: '<', value: 100 },
  { column: 'inStock', operator: '=', value: true }
]);
// "SELECT COUNT(*) as count FROM "products" WHERE price < @price AND inStock = @inStock"
```

### BuildJoin

```typescript
public static BuildJoin(
  fromTableName: string,
  joins: Join | Join[],
  options?: DefaultQueryOptions & QueryOptions
): string
```

Builds a SELECT statement with JOIN operations (INNER, LEFT, RIGHT, FULL).

**Parameters:**
- `fromTableName` (string): The primary table to select from
- `joins` (Join | Join[]): Single Join object or array of Join objects
- `options` (optional): Query options (select, where, orderBy, limit, offset)

**Join Object Structure:**
```typescript
type Join = {
  fromTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  on: QueryWhereParameters | QueryWhereParameters[];
  where?: QueryWhereParameters | QueryWhereParameters[];
}
```

**Returns:** Complete SELECT statement with JOIN clauses

**Examples:**
```typescript
// Simple INNER JOIN
const query = QueryStatementBuilder.BuildJoin(
  'users',
  { 
    fromTable: 'orders', 
    joinType: 'INNER', 
    on: { user_id: 'id' } 
  },
  { select: 'users.name, orders.total' }
);
// "SELECT users.name, orders.total FROM "users" INNER JOIN "orders" ON users.id = orders.user_id"

// LEFT JOIN with WHERE clause
const query = QueryStatementBuilder.BuildJoin(
  'users',
  { 
    fromTable: 'profiles', 
    joinType: 'LEFT', 
    on: { user_id: 'id' } 
  },
  { 
    where: { 'users.status': 'active' },
    orderBy: 'users.created_at DESC'
  }
);
// "SELECT * FROM "users" LEFT JOIN "profiles" ON users.id = profiles.user_id WHERE users.status = @users.status ORDER BY users.created_at DESC"

// Multiple JOINs
const query = QueryStatementBuilder.BuildJoin(
  'users',
  [
    { fromTable: 'orders', joinType: 'INNER', on: { user_id: 'id' } },
    { fromTable: 'products', joinType: 'INNER', on: { product_id: 'id' } }
  ],
  { 
    select: 'users.name, orders.order_date, products.name as product_name',
    limit: 10 
  }
);
// "SELECT users.name, orders.order_date, products.name as product_name FROM "users" INNER JOIN "orders" ON users.id = orders.user_id INNER JOIN "products" ON orders.id = products.product_id LIMIT 10"

// RIGHT JOIN with multiple ON conditions
const query = QueryStatementBuilder.BuildJoin(
  'orders',
  { 
    fromTable: 'users', 
    joinType: 'RIGHT', 
    on: [
      { user_id: 'id' },
      { company_id: 'company_id' }
    ]
  }
);
// "SELECT * FROM "orders" RIGHT JOIN "users" ON orders.id = users.user_id AND orders.company_id = users.company_id"
```

### BuildWhere

```typescript
public static BuildWhere(where?: QueryCondition): string
```

Builds a WHERE clause from parameter conditions (helper method).

**Parameters:**
- `where` (optional, QueryCondition): WHERE conditions

**Returns:** WHERE clause string with `@fieldName` placeholders, or empty string if no conditions

**Examples:**
```typescript
// Simple conditions
const whereClause = QueryStatementBuilder.BuildWhere({ 
  status: 'active', 
  role: 'admin' 
});
// "WHERE status = @status AND role = @role"

// With operators
const whereClause = QueryStatementBuilder.BuildWhere([
  { column: 'age', operator: '>=', value: 18 },
  { column: 'country', operator: '=', value: 'US' }
]);
// "WHERE age >= @age AND country = @country"

// No conditions
const whereClause = QueryStatementBuilder.BuildWhere();
// ""
```

### BuildQueryOptions

```typescript
public static BuildQueryOptions(options: QueryOptions): string
```

Builds query options clause (ORDER BY, LIMIT, OFFSET) (helper method).

**Parameters:**
- `options` (QueryOptions): Object containing orderBy, limit, and/or offset

**Returns:** Query options clause as a string

**Examples:**
```typescript
// All options
const optionsClause = QueryStatementBuilder.BuildQueryOptions({
  orderBy: 'created_at DESC',
  limit: 10,
  offset: 20
});
// "ORDER BY created_at DESC LIMIT 10 OFFSET 20"

// Just ordering
const optionsClause = QueryStatementBuilder.BuildQueryOptions({
  orderBy: 'name ASC, created_at DESC'
});
// "ORDER BY name ASC, created_at DESC"

// Pagination only
const optionsClause = QueryStatementBuilder.BuildQueryOptions({
  limit: 25,
  offset: 50
});
// "LIMIT 25 OFFSET 50"
```

## Usage Examples

### Building a Complete Query Workflow

```typescript
import QueryStatementBuilder from '@kirbkis/database-handler-core/helpers/QueryStatementBuilder';
import Query from '@kirbkis/database-handler-core/base/Query';

// Build the SQL query string
const sql = QueryStatementBuilder.BuildSelect('users', {
  select: 'id, name, email, age',
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10
});

// Create a Query instance with the built SQL
const query = new Query('users', sql);

// Set the parameters (matches the WHERE conditions)
query.Parameters = { status: 'active' };

// Execute the query
const users = await query.All<User>();
```

### Dynamic Query Building

```typescript
// Build query conditionally
const conditions: any = {};
if (filterByAge) {
  conditions.age = minAge;
}
if (filterByStatus) {
  conditions.status = 'active';
}

const sql = QueryStatementBuilder.BuildSelect('users', {
  where: Object.keys(conditions).length > 0 ? conditions : undefined,
  orderBy: sortBy,
  limit: pageSize,
  offset: page * pageSize
});

const query = new Query('users', sql);
query.Parameters = conditions;
const results = await query.All();
```

### Complex WHERE with Operators

```typescript
// Age range and status check
const sql = QueryStatementBuilder.BuildSelect('users', {
  where: [
    { column: 'age', operator: '>=', value: 18 },
    { column: 'age', operator: '<=', value: 65 },
    { column: 'status', operator: '=', value: 'active' }
  ]
});

const query = new Query('users', sql);
query.Parameters = { age: 18, status: 'active' }; // Note: operator conditions still use simple params
const adults = await query.All<User>();
```

### INSERT with Builder

```typescript
const newUser = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 28,
  status: 'active',
  createdAt: new Date()
};

const sql = QueryStatementBuilder.BuildInsert('users', newUser);
const query = new Query('users', sql);
query.Parameters = newUser;

await query.Run();
```

### UPDATE with Builder

```typescript
const updates = {
  status: 'inactive',
  lastModified: new Date()
};

const conditions = { id: userId };

const sql = QueryStatementBuilder.BuildUpdate('users', updates, conditions);
const query = new Query('users', sql);

// Combine both update values and where conditions
query.Parameters = {
  ...updates,
  where_id: userId  // Note the where_ prefix
};

await query.Run();
```

### DELETE with Builder

```typescript
const sql = QueryStatementBuilder.BuildDelete('sessions', {
  expiresAt: pastDate,
  status: 'expired'
});

const query = new Query('sessions', sql);
query.Parameters = { expiresAt: pastDate, status: 'expired' };

await query.Run();
```

### COUNT with Builder

```typescript
const sql = QueryStatementBuilder.BuildCount('orders', {
  status: 'pending',
  createdAt: today
});

const query = new Query('orders', sql);
query.Parameters = { status: 'pending', createdAt: today };

const pendingCount = await query.Count();
console.log(`Pending orders: ${pendingCount}`);
```

### JOIN with Builder

```typescript
// Users with their orders
const sql = QueryStatementBuilder.BuildJoin(
  'users',
  { 
    fromTable: 'orders', 
    joinType: 'INNER', 
    on: { user_id: 'id' } 
  },
  {
    select: 'users.id, users.name, orders.id as order_id, orders.total',
    where: { 'orders.status': 'completed' },
    orderBy: 'orders.created_at DESC',
    limit: 50
  }
);

const query = new Query('users', sql);
query.Parameters = { 'orders.status': 'completed' };

const usersWithOrders = await query.All();
```

### Advanced Multi-Table JOIN

```typescript
// Users, their orders, and ordered products
const sql = QueryStatementBuilder.BuildJoin(
  'users',
  [
    { 
      fromTable: 'orders', 
      joinType: 'INNER', 
      on: { user_id: 'id' } 
    },
    { 
      fromTable: 'order_items', 
      joinType: 'INNER', 
      on: { order_id: 'id' } 
    },
    { 
      fromTable: 'products', 
      joinType: 'LEFT', 
      on: { product_id: 'id' } 
    }
  ],
  {
    select: `
      users.name as customer_name,
      orders.order_date,
      products.name as product_name,
      order_items.quantity,
      order_items.price
    `,
    where: { 'orders.status': 'completed' },
    orderBy: 'orders.order_date DESC',
    limit: 100
  }
);

const query = new Query('users', sql);
query.Parameters = { 'orders.status': 'completed' };

const orderDetails = await query.All();
```

## Integration with Query Class

QueryStatementBuilder is designed to work seamlessly with the Query class:

1. **Build the SQL**: Use QueryStatementBuilder to create a SQL string with parameter placeholders
2. **Create Query instance**: Pass the SQL string to the Query constructor
3. **Set Parameters**: Assign parameter values to `query.Parameters`
4. **Execute**: Call the appropriate Query method (`All`, `Get`, `Run`, `Count`)

**Example Flow:**
```typescript
// 1. Build
const sql = QueryStatementBuilder.BuildSelect('products', {
  where: { category: 'electronics' },
  orderBy: 'price ASC',
  limit: 10
});

// 2. Create
const query = new Query('products', sql);

// 3. Parameters
query.Parameters = { category: 'electronics' };

// 4. Execute
const products = await query.All<Product>();
```

## Best Practices

1. **Use Builder for Standard Operations**: For typical CRUD operations, QueryStatementBuilder provides type safety and reduces SQL syntax errors

2. **Combine with Query Class**: Always use QueryStatementBuilder output with the Query class for execution and result mapping

3. **Parameter Naming**: 
   - WHERE parameters in UPDATE use `where_` prefix automatically
   - Keep parameter names consistent between builder conditions and Parameter assignment

4. **Type Safety**: Define TypeScript interfaces for your data to get full type checking:
   ```typescript
   type User = {
     id: number;
     name: string;
     email: string;
   };
   
   const users = await query.All<User>();
   ```

5. **Dynamic Queries**: Build WHERE conditions dynamically based on user input or application state:
   ```typescript
   const where = {};
   if (searchTerm) where.name = searchTerm;
   if (minAge) where.age = minAge;
   
   const sql = QueryStatementBuilder.BuildSelect('users', { where });
   ```

6. **Reusable Queries**: Store commonly used queries as functions:
   ```typescript
   function getUsersByStatus(status: string) {
     const sql = QueryStatementBuilder.BuildSelect('users', {
       where: { status }
     });
     const query = new Query('users', sql);
     query.Parameters = { status };
     return query.All<User>();
   }
   ```

## Notes

- All table and column names are automatically quoted in the generated SQL
- Parameter placeholders use `@paramName` syntax (PostgreSQL adapter compatible)
- WHERE conditions are joined with AND operator
- The builder focuses on common SQL patterns; for complex queries, consider using the Query class directly with raw SQL
- Generated SQL is compatible with both PostgreSQL and BetterSQLite3 adapters
