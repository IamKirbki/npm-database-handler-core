# Table Class Documentation

The `Table` class provides a high-level interface for interacting with database tables. It offers methods for querying, inserting, counting records, performing joins, and managing table metadata.

## Table of Contents
- [Overview](#overview)
- [Constructor](#constructor)
- [Methods](#methods)
  - [Records](#records)
  - [Record](#record)
  - [RecordsCount](#recordscount)
  - [Insert](#insert)
  - [Join](#join)
  - [TableColumnInformation](#tablecolumninformation)
  - [ReadableTableColumnInformation](#readabletablecolumninformation)
  - [Drop](#drop)
- [Usage Examples](#usage-examples)

## Overview

The Table class provides a convenient, type-safe way to interact with database tables without writing raw SQL. It automatically:
- Builds optimized SQL queries using QueryStatementBuilder
- Handles parameter binding with `@paramName` syntax
- Returns strongly-typed Record objects
- Supports filtering, sorting, and pagination
- Manages JOIN operations with automatic result splitting

Tables are typically created as instances to represent your database tables, though the constructor is available if needed.

## Constructor

```typescript
constructor(name: string, customAdapter?: string)
```

**Parameters:**
- `name` (string): The name of the database table
- `customAdapter` (optional, string): Name of a specific adapter to use for all operations on this table (defaults to the default adapter registered in Container)

**Example:**
```typescript
import { Table } from '@kirbkis/database-handler-core';

const usersTable = new Table('users');
const postsTable = new Table('posts');
const productsTable = new Table('products');

// With custom adapter
const analyticsTable = new Table('events', 'analytics');
```

## Methods

### Records

```typescript
public async Records<Type extends columnType>(
  options?: DefaultQueryOptions & QueryOptions
): Promise<Record<Type>[]>
```

Fetch multiple records from the table with optional filtering, ordering, and pagination.

**Parameters:**
- `options` (optional):
  - `select` (string): Columns to select (default: `*`)
  - `where` (QueryCondition): WHERE clause conditions
  - `orderBy` (string): ORDER BY clause (e.g., `'created_at DESC'`)
  - `limit` (number): Maximum number of records to return
  - `offset` (number): Number of records to skip

**Returns:** Array of Record objects

**Examples:**

```typescript
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  status: string;
  created_at: Date;
};

const usersTable = new Table('users');

// Get all records
const allUsers = await usersTable.Records<User>();

// Get specific columns
const userNames = await usersTable.Records<User>({
  select: 'id, name, email'
});

// Filter with WHERE clause
const activeUsers = await usersTable.Records<User>({
  where: { status: 'active' }
});

// Multiple WHERE conditions
const adultActiveUsers = await usersTable.Records<User>({
  where: { status: 'active', age: 25 }
});

// WHERE with operators
const youngUsers = await usersTable.Records<User>({
  where: [
    { column: 'age', operator: '<', value: 30 },
    { column: 'status', operator: '=', value: 'active' }
  ]
});

// With ordering
const recentUsers = await usersTable.Records<User>({
  where: { status: 'active' },
  orderBy: 'created_at DESC'
});

// With pagination
const page2Users = await usersTable.Records<User>({
  orderBy: 'name ASC',
  limit: 20,
  offset: 20
});

// Full query with all options
const results = await usersTable.Records<User>({
  select: 'id, name, email, age',
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10,
  offset: 0
});

// Access record values
results.forEach(user => {
  console.log(`${user.values.name} - ${user.values.email}`);
});
```

### Record

```typescript
public async Record<Type extends columnType>(
  options?: DefaultQueryOptions & QueryOptions
): Promise<Record<Type> | undefined>
```

Fetch a single record from the table. Automatically limits results to 1 record.

**Parameters:**
- `options` (optional): Same as Records method

**Returns:** Single Record object or `undefined` if not found

**Examples:**

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

const usersTable = new Table('users');

// Get by ID
const user = await usersTable.Record<User>({
  where: { id: 1 }
});

if (user) {
  console.log(user.values.name);
}

// Get by email
const userByEmail = await usersTable.Record<User>({
  where: { email: 'alice@example.com' }
});

// Get with specific columns
const userBasic = await usersTable.Record<User>({
  select: 'id, name',
  where: { id: 1 }
});

// Get most recent active user
const recentUser = await usersTable.Record<User>({
  where: { status: 'active' },
  orderBy: 'created_at DESC'
});

// Always check for undefined
const maybeUser = await usersTable.Record<User>({
  where: { id: 999 }
});

if (!maybeUser) {
  console.log('User not found');
} else {
  console.log(`Found: ${maybeUser.values.name}`);
}
```

### RecordsCount

```typescript
public async RecordsCount(): Promise<number>
```

Get the total count of all records in the table.

**Returns:** Number of records

**Example:**

```typescript
const usersTable = new Table('users');

const totalUsers = await usersTable.RecordsCount();
console.log(`Total users: ${totalUsers}`);

// For conditional counts, use Query class directly
import { Query, QueryStatementBuilder } from '@kirbkis/database-handler-core';

const sql = QueryStatementBuilder.BuildCount('users', { status: 'active' });
const query = new Query('users', sql, { status: 'active' });
const activeCount = await query.Count();
console.log(`Active users: ${activeCount}`);
```

### Insert

```typescript
public async Insert<Type extends columnType>(
  values: Type
): Promise<Record<Type> | undefined>
```

Insert a new record into the table.

**Parameters:**
- `values` (object): Column values for the new record

**Returns:** Record object with auto-generated values (like ID), or `undefined` if failed

**Examples:**

```typescript
type User = {
  id?: number;
  name: string;
  email: string;
  age: number;
  created_at?: Date;
};

const usersTable = new Table('users');

// Simple insert
const newUser = await usersTable.Insert<User>({
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 28
});

if (newUser) {
  console.log(`Created user with ID: ${newUser.values.id}`);
  console.log(`Created at: ${newUser.values.created_at}`);
}

// Insert with all fields
const completeUser = await usersTable.Insert<User>({
  name: 'Bob Johnson',
  email: 'bob@example.com',
  age: 35,
  created_at: new Date()
});

// Bulk insert
type Product = {
  id?: number;
  name: string;
  price: number;
  category: string;
};

const productsTable = new Table('products');

const productsData = [
  { name: 'Laptop', price: 999.99, category: 'electronics' },
  { name: 'Mouse', price: 29.99, category: 'electronics' },
  { name: 'Desk', price: 299.99, category: 'furniture' }
];

const insertedProducts: Record<Product>[] = [];

for (const data of productsData) {
  const product = await productsTable.Insert<Product>(data);
  if (product) {
    insertedProducts.push(product);
  }
}

console.log(`Inserted ${insertedProducts.length} products`);
```

### Join

```typescript
public async Join<Type extends columnType>(
  Joins: Join | Join[],
  options?: DefaultQueryOptions & QueryOptions
): Promise<Record<Type>[]>
```

Perform JOIN operations with other tables. Automatically splits joined data into nested objects.

**Parameters:**
- `Joins` (Join | Join[]): Single join or array of joins
- `options` (optional): Query options (select, where, orderBy, limit, offset)

**Join Object Structure:**
```typescript
type Join = {
  fromTable: string;           // Table to join
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  on: { [foreignKey]: primaryKey };  // Join condition
  where?: QueryWhereParameters; // Additional WHERE for this join
}
```

**Returns:** Array of Record objects with nested joined data

**Examples:**

```typescript
type UserWithOrders = {
  id: number;
  name: string;
  email: string;
  orders: {
    id: number;
    user_id: number;
    total: number;
    status: string;
  };
};

const usersTable = new Table('users');

// Simple INNER JOIN
const usersWithOrders = await usersTable.Join<UserWithOrders>(
  {
    fromTable: 'orders',
    joinType: 'INNER',
    on: { user_id: 'id' } // orders.user_id = users.id
  },
  {
    select: 'users.id, users.name, users.email, orders.id as order_id, orders.total, orders.status',
    where: { 'orders.status': 'completed' }
  }
);

// Access joined data
usersWithOrders.forEach(record => {
  console.log(`User: ${record.values.name}`);
  console.log(`Order Total: ${record.values.orders.total}`);
});

// LEFT JOIN (include users without orders)
const allUsersWithOrders = await usersTable.Join(
  {
    fromTable: 'orders',
    joinType: 'LEFT',
    on: { user_id: 'id' }
  },
  {
    orderBy: 'users.created_at DESC'
  }
);

// Multiple JOINs
type UserWithOrdersAndProducts = {
  id: number;
  name: string;
  orders: {
    id: number;
    total: number;
  };
  products: {
    id: number;
    name: string;
    price: number;
  };
};

const complexJoin = await usersTable.Join<UserWithOrdersAndProducts>([
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
    joinType: 'INNER',
    on: { product_id: 'id' }
  }
], {
  where: { 'orders.status': 'completed' },
  limit: 50
});

// RIGHT JOIN
const ordersWithUsers = await usersTable.Join(
  {
    fromTable: 'orders',
    joinType: 'RIGHT',
    on: { user_id: 'id' }
  }
);

// FULL OUTER JOIN
const allUsersAndOrders = await usersTable.Join(
  {
    fromTable: 'orders',
    joinType: 'FULL',
    on: { user_id: 'id' }
  }
);

// Join with multiple ON conditions
const complexOn = await usersTable.Join(
  {
    fromTable: 'orders',
    joinType: 'INNER',
    on: [
      { user_id: 'id' },
      { company_id: 'company_id' }
    ]
  }
);
```

**How Join Result Splitting Works:**

The Join method automatically organizes joined data into nested objects based on table names:

```typescript
// Database result (flat):
// { user_id: 1, user_name: 'Alice', order_id: 100, order_total: 99.99 }

// After splitting (nested):
const result = {
  id: 1,
  name: 'Alice',
  orders: {
    id: 100,
    total: 99.99
  }
};

// Access via record.values
console.log(result.values.name);           // 'Alice' (from users table)
console.log(result.values.orders.total);   // 99.99 (from orders table)
```

### TableColumnInformation

```typescript
public async TableColumnInformation(): Promise<TableColumnInfo[]>
```

Get raw column information from the database for this table.

**Returns:** Array of TableColumnInfo objects

**TableColumnInfo Structure:**
```typescript
type TableColumnInfo = {
  cid: number;        // Column ID
  name: string;       // Column name
  type: string;       // Data type
  notnull: number;    // 0 or 1
  dflt_value: unknown; // Default value
  pk: number;         // 1 if primary key, 0 otherwise
};
```

**Example:**

```typescript
const usersTable = new Table('users');

const columns = await usersTable.TableColumnInformation();

columns.forEach(col => {
  console.log(`${col.name} (${col.type})`);
  console.log(`  Primary Key: ${col.pk === 1}`);
  console.log(`  Nullable: ${col.notnull === 0}`);
  console.log(`  Default: ${col.dflt_value}`);
});

// Example output:
// id (INTEGER)
//   Primary Key: true
//   Nullable: false
//   Default: null
// name (TEXT)
//   Primary Key: false
//   Nullable: false
//   Default: null
// email (TEXT)
//   Primary Key: false
//   Nullable: false
//   Default: null
```

### ReadableTableColumnInformation

```typescript
public async ReadableTableColumnInformation(): Promise<ReadableTableColumnInfo[]>
```

Get formatted, human-readable column information for this table.

**Returns:** Array of ReadableTableColumnInfo objects

**ReadableTableColumnInfo Structure:**
```typescript
type ReadableTableColumnInfo = {
  name: string;          // Column name
  type: string;          // Data type
  nullable: boolean;     // true if NULL allowed
  isPrimaryKey: boolean; // true if primary key
  defaultValue: unknown; // Default value
};
```

**Example:**

```typescript
const usersTable = new Table('users');

const columns = await usersTable.ReadableTableColumnInformation();

columns.forEach(col => {
  console.log(`Column: ${col.name}`);
  console.log(`  Type: ${col.type}`);
  console.log(`  Nullable: ${col.nullable}`);
  console.log(`  Primary Key: ${col.isPrimaryKey}`);
  console.log(`  Default: ${col.defaultValue ?? 'none'}`);
  console.log('---');
});

// Generate documentation
const docs = columns.map(col => {
  const nullable = col.nullable ? 'NULL' : 'NOT NULL';
  const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
  return `${col.name}: ${col.type} ${nullable}${pk}`;
}).join('\n');

console.log(docs);
// id: INTEGER NOT NULL PRIMARY KEY
// name: TEXT NOT NULL
// email: TEXT NOT NULL
// age: INTEGER NULL
```

### Drop

```typescript
public async Drop(): Promise<void>
```

Drop (delete) this table from the database. **Use with caution** - this permanently deletes the table and all its data.

**Example:**

```typescript
const tempTable = new Table('temp_data');

// Drop the table
await tempTable.Drop();
console.log('Table dropped');

// Table and all data are permanently deleted
```

**Warning:** This operation is **irreversible**. All data in the table will be permanently lost.

## Usage Examples

### Using Custom Adapters

If you have multiple database connections registered in the Container, you can specify which adapter to use when creating a Table instance. All operations on that table will use the specified adapter:

```typescript
import { Container, Table } from '@kirbkis/database-handler-core';
import { PostgresAdapter } from '@kirbkis/database-handler-pg';
import { BetterSqlite3Adapter } from '@kirbkis/database-handler-better-sqlite3';

type User = {
  id: number;
  name: string;
  email: string;
};

type Event = {
  id: number;
  event_name: string;
  timestamp: Date;
};

// Register multiple adapters
const container = Container.getInstance();
const mainDb = new PostgresAdapter();
const analyticsDb = new BetterSqlite3Adapter();

mainDb.connect(pgConfig);
analyticsDb.connect('./analytics.db');

container.registerAdapter('postgres', mainDb, true); // Default adapter
container.registerAdapter('analytics', analyticsDb);

// Table using default adapter (postgres)
const usersTable = new Table('users');
const users = await usersTable.Records<User>();

// Table using analytics adapter
const eventsTable = new Table('events', 'analytics');
const events = await eventsTable.Records<Event>({ 
  where: { event_name: 'page_view' } 
});

// All operations on eventsTable use the analytics adapter
const eventCount = await eventsTable.RecordsCount();
const newEvent = await eventsTable.Insert<Event>({
  event_name: 'user_signup',
  timestamp: new Date()
});
```

### Basic CRUD Operations

```typescript
import { Table } from '@kirbkis/database-handler-core';

type User = {
  id?: number;
  name: string;
  email: string;
  age: number;
};

const usersTable = new Table('users');

// CREATE
const newUser = await usersTable.Insert<User>({
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 28
});

// READ (single)
const user = await usersTable.Record<User>({
  where: { id: newUser?.values.id }
});

// READ (multiple)
const allUsers = await usersTable.Records<User>({
  orderBy: 'name ASC'
});

// UPDATE
if (user) {
  await user.Update(
    { age: 29 },
    { id: user.values.id }
  );
}

// DELETE
if (user) {
  await user.Delete({ id: user.values.id });
}

// COUNT
const totalUsers = await usersTable.RecordsCount();
console.log(`Total users: ${totalUsers}`);
```

### Pagination

```typescript
type Post = {
  id: number;
  title: string;
  content: string;
  created_at: Date;
};

const postsTable = new Table('posts');

const pageSize = 10;
const page = 2; // 0-indexed

const posts = await postsTable.Records<Post>({
  orderBy: 'created_at DESC',
  limit: pageSize,
  offset: page * pageSize
});

console.log(`Showing posts ${page * pageSize + 1} to ${(page + 1) * pageSize}`);
```

### Search and Filter

```typescript
type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
};

const productsTable = new Table('products');

// Simple search
const electronics = await productsTable.Records<Product>({
  where: { category: 'electronics' }
});

// Complex filter
const affordableInStock = await productsTable.Records<Product>({
  where: [
    { column: 'price', operator: '<', value: 100 },
    { column: 'inStock', operator: '=', value: true }
  ],
  orderBy: 'price ASC'
});

// Multiple categories (using IN operator via raw Query)
import { Query, QueryStatementBuilder } from '@kirbkis/database-handler-core';

const sql = `SELECT * FROM products WHERE category IN (@cat1, @cat2)`;
const query = new Query('products', sql, { cat1: 'electronics', cat2: 'furniture' });
const multiCategoryProducts = await query.All<Product>();
```

### Table Relationships

```typescript
type Order = {
  id: number;
  user_id: number;
  total: number;
  status: string;
  created_at: Date;
};

type User = {
  id: number;
  name: string;
  email: string;
};

const ordersTable = new Table('orders');
const usersTable = new Table('users');

// Get order with user information
const ordersWithUsers = await ordersTable.Join({
  fromTable: 'users',
  joinType: 'INNER',
  on: { user_id: 'id' }
}, {
  select: 'orders.*, users.name as user_name, users.email',
  where: { 'orders.status': 'pending' },
  orderBy: 'orders.created_at DESC'
});

ordersWithUsers.forEach(order => {
  console.log(`Order #${order.values.id} by ${order.values.users.name}`);
  console.log(`Total: $${order.values.total}`);
});
```

### Dynamic Queries

```typescript
async function getUsers(filters: {
  status?: string;
  minAge?: number;
  maxAge?: number;
  searchTerm?: string;
}, pagination: { page: number; pageSize: number }) {
  
  const where: any[] = [];
  
  if (filters.status) {
    where.push({ column: 'status', operator: '=', value: filters.status });
  }
  
  if (filters.minAge !== undefined) {
    where.push({ column: 'age', operator: '>=', value: filters.minAge });
  }
  
  if (filters.maxAge !== undefined) {
    where.push({ column: 'age', operator: '<=', value: filters.maxAge });
  }
  
  if (filters.searchTerm) {
    where.push({ column: 'name', operator: 'LIKE', value: `%${filters.searchTerm}%` });
  }
  
  const usersTable = new Table('users');
  
  return await usersTable.Records<User>({
    where: where.length > 0 ? where : undefined,
    orderBy: 'created_at DESC',
    limit: pagination.pageSize,
    offset: pagination.page * pagination.pageSize
  });
}

// Usage
const results = await getUsers(
  { status: 'active', minAge: 18, maxAge: 65 },
  { page: 0, pageSize: 20 }
);
```

### Table Metadata and Schema Inspection

```typescript
const usersTable = new Table('users');

// Get column information
const columns = await usersTable.ReadableTableColumnInformation();

// Generate TypeScript interface from schema
const interfaceStr = `type User = {\n${columns.map(col => {
  const optional = col.nullable ? '?' : '';
  let tsType = 'unknown';
  
  if (col.type.includes('INT')) tsType = 'number';
  else if (col.type.includes('TEXT') || col.type.includes('VARCHAR')) tsType = 'string';
  else if (col.type.includes('BOOL')) tsType = 'boolean';
  else if (col.type.includes('DATE') || col.type.includes('TIME')) tsType = 'Date';
  
  return `  ${col.name}${optional}: ${tsType};`;
}).join('\n')}\n};`;

console.log(interfaceStr);

// Generate SQL CREATE statement
const createSQL = `CREATE TABLE users (\n${columns.map(col => {
  const nullable = col.nullable ? 'NULL' : 'NOT NULL';
  const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
  const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
  return `  ${col.name} ${col.type} ${nullable}${pk}${def}`;
}).join(',\n')}\n);`;

console.log(createSQL);
```

### Batch Operations

```typescript
// Batch update
const usersTable = new Table('users');

const inactiveUsers = await usersTable.Records<User>({
  where: { status: 'inactive' }
});

for (const user of inactiveUsers) {
  await user.Update(
    { status: 'archived', archived_at: new Date().toISOString() },
    { id: user.values.id }
  );
}

console.log(`Archived ${inactiveUsers.length} inactive users`);

// Batch delete
const oldRecords = await usersTable.Records<User>({
  where: [
    { column: 'last_login', operator: '<', value: '2024-01-01' }
  ]
});

for (const record of oldRecords) {
  await record.Delete({ id: record.values.id });
}

console.log(`Deleted ${oldRecords.length} old records`);
```

## Best Practices

1. **Use Type Definitions**: Always specify types for type-safe results
   ```typescript
   const users = await usersTable.Records<User>(); // Type-safe
   ```

2. **Handle Undefined**: Always check if Record() returns undefined
   ```typescript
   const user = await usersTable.Record<User>({ where: { id: 1 } });
   if (!user) {
     // Handle not found
     return;
   }
   // Safe to use user here
   ```

3. **Use Pagination**: Always limit results for large tables
   ```typescript
   const users = await usersTable.Records<User>({
     limit: 50,
     offset: page * 50
   });
   ```

4. **Prefer Table Methods**: Use Table methods over creating Records manually
   ```typescript
   // Good
   const user = await usersTable.Insert<User>({ name: 'Alice', ... });
   
   // Less preferred
   const record = new Record<User>('users', { name: 'Alice', ... });
   await record.Insert();
   ```

5. **Index WHERE Columns**: Ensure columns used in WHERE clauses have database indexes
   ```sql
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_users_status ON users(status);
   ```

6. **Use Specific SELECT**: Only select columns you need
   ```typescript
   const users = await usersTable.Records<User>({
     select: 'id, name, email' // Don't select large columns if not needed
   });
   ```

7. **Batch Operations Carefully**: Be mindful of database load
   ```typescript
   // Consider using transactions for batch operations
   // Consider rate limiting for large batch operations
   ```

## Notes

- All queries use the `@paramName` placeholder syntax
- Table methods automatically build optimized SQL using QueryStatementBuilder
- JOIN results are automatically split into nested objects by table name
- Compatible with both BetterSQLite3 and PostgreSQL adapters
- Table operations are asynchronous and return Promises
- Records returned are independent instances - modifying one doesn't affect others
- **Custom Adapters**: Pass an adapter name to the constructor to use a specific database connection for all operations on that table
