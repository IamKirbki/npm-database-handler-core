# Record Class Documentation

The `Record` class represents a single database row with methods for insertion, updates, deletion, and serialization. It wraps your data with type safety and provides utility methods for common database operations.

## Table of Contents
- [Overview](#overview)
- [Constructor](#constructor)
- [Properties](#properties)
- [Methods](#methods)
  - [Insert](#insert)
  - [Update](#update)
  - [Delete](#delete)
  - [toJSON](#tojson)
  - [toString](#tostring)
- [Usage Examples](#usage-examples)
- [Automatic Timestamps](#automatic-timestamps)

## Overview

The Record class provides an object-oriented interface for working with individual database rows. It automatically handles:
- Type-safe data access
- Insert operations with automatic ID retrieval
- Update operations with optional timestamp tracking
- Soft/hard delete operations
- JSON serialization for APIs

Records are typically returned by Table methods (`Records()`, `Record()`, `Join()`) or Query methods (`All()`, `Get()`), but you can also create them manually for insertions.

## Constructor

```typescript
constructor(values: ColumnValuesType, table: string)
```

**Parameters:**
- `values` (object): The column values for this record
- `table` (string): The name of the table this record belongs to

**Example:**
```typescript
type User = {
  id?: number;
  name: string;
  email: string;
  age: number;
};

// Create a new record for insertion
const newUser = new Record<User>({
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 28
}, 'users');

await newUser.Insert();
```

## Properties

### values
```typescript
public get values(): ColumnValuesType
```

Returns the raw values object containing all column data for this record (read-only).

**Example:**
```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  console.log(user.values);
  // { id: 1, name: 'Alice Smith', email: 'alice@example.com', age: 28 }
  
  // Access individual properties
  console.log(user.values.name);    // 'Alice Smith'
  console.log(user.values.email);   // 'alice@example.com'
}
```

## Methods

### Insert

```typescript
public async Insert(): Promise<this | undefined>
```

Inserts this record into the database and updates the record with any auto-generated values (like auto-increment IDs).

**Returns:** The record instance with updated values, or `undefined` if the insert failed.

**Example:**
```typescript
type Product = {
  id?: number;
  name: string;
  price: number;
  category: string;
  createdAt?: Date;
};

// Create new record
const product = new Record<Product>({
  name: 'Laptop',
  price: 999.99,
  category: 'electronics'
}, 'products');

// Insert into database
const insertedProduct = await product.Insert();

if (insertedProduct) {
  console.log(insertedProduct.values.id); // Auto-generated ID: 42
  console.log(insertedProduct.values.createdAt); // Auto-generated timestamp
}
```

**Notes:**
- Automatically retrieves auto-generated ID values
- Compatible with both BetterSQLite3 and PostgreSQL adapters
- Throws error if record has no columns
- After insertion, the record's values are updated with any database-generated values

### Update

```typescript
public async Update(
  newValues: Partial<ColumnValuesType>, 
  primaryKey: QueryWhereParameters
): Promise<this>
```

Updates this record in the database with new values.

**Parameters:**
- `newValues` (object): Partial object containing columns to update
- `primaryKey` (object): Object identifying the record (typically `{ id: recordId }`)

**Returns:** The updated record instance

**Example:**
```typescript
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  updatedAt?: string;
};

const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  // Update specific fields
  await user.Update(
    { age: 29, email: 'newemail@example.com' },
    { id: user.values.id }
  );
  
  console.log(user.values.age);        // 29
  console.log(user.values.email);      // 'newemail@example.com'
  console.log(user.values.updatedAt);  // Auto-updated timestamp (if column exists)
}
```

**Automatic Timestamp Handling:**
If your record has an `updated_at` column, it will be automatically set to the current timestamp:
```typescript
// If your table has updated_at column
type Post = {
  id: number;
  title: string;
  content: string;
  updated_at?: string;
};

await post.Update({ content: 'New content' }, { id: post.values.id });
// updated_at is automatically set to current ISO timestamp
```

**Notes:**
- Only updates the specified fields
- WHERE clause parameters are automatically prefixed with `where_`
- Record's internal values are updated after successful database update
- Works with partial updates (you don't need to provide all columns)

### Delete

```typescript
public async Delete(primaryKey: QueryWhereParameters): Promise<void>
```

Deletes this record from the database. Supports soft deletes if the table has a `deleted_at` column.

**Parameters:**
- `primaryKey` (object): Object identifying the record to delete (typically `{ id: recordId }`)

**Example:**
```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  // Hard delete
  await user.Delete({ id: user.values.id });
  // Record is permanently removed from database
}
```

**Soft Delete Example:**
```typescript
type Post = {
  id: number;
  title: string;
  content: string;
  deleted_at?: string;
};

const post = await postsTable.Record<Post>({ where: { id: 5 } });

if (post) {
  // Soft delete - sets deleted_at timestamp instead of removing record
  await post.Delete({ id: post.values.id });
  
  console.log(post.values.deleted_at); // ISO timestamp of deletion
  // Record still exists in database but marked as deleted
}
```

**Notes:**
- **Soft Delete**: If table has `deleted_at` column, sets timestamp instead of removing record
- **Hard Delete**: If no `deleted_at` column, permanently removes record from database
- Soft-deleted records can be restored or permanently deleted later

### toJSON

```typescript
public toJSON(): ColumnValuesType
```

Returns the values object for JSON serialization. Used automatically by `JSON.stringify()`.

**Returns:** The raw values object

**Example:**
```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  // Automatic use with JSON.stringify
  const json = JSON.stringify(user);
  // {"id":1,"name":"Alice","email":"alice@example.com","age":28}
  
  // Manual use
  const data = user.toJSON();
  console.log(data); // { id: 1, name: 'Alice', email: 'alice@example.com', age: 28 }
}
```

**Use in APIs:**
```typescript
// Express.js example
app.get('/api/users/:id', async (req, res) => {
  const user = await usersTable.Record<User>({ 
    where: { id: parseInt(req.params.id) } 
  });
  
  if (user) {
    res.json(user); // Automatically calls toJSON()
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});
```

### toString

```typescript
public toString(): string
```

Converts the record to a pretty-printed JSON string.

**Returns:** Formatted JSON string with 2-space indentation

**Example:**
```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  console.log(user.toString());
  // {
  //   "id": 1,
  //   "name": "Alice",
  //   "email": "alice@example.com",
  //   "age": 28
  // }
  
  // Also works with console.log directly due to custom inspect
  console.log(user);
  // Outputs the values object in a readable format
}
```

## Usage Examples

### Creating and Inserting a New Record

```typescript
import { Record } from '@kirbkis/database-handler-core';

type User = {
  id?: number;
  name: string;
  email: string;
  age: number;
  createdAt?: Date;
};

// Create new user record
const newUser = new Record<User>({
  name: 'Bob Johnson',
  email: 'bob@example.com',
  age: 35
}, 'users');

// Insert into database
const insertedUser = await newUser.Insert();

if (insertedUser) {
  console.log(`New user created with ID: ${insertedUser.values.id}`);
}
```

### Retrieving and Updating a Record

```typescript
// Get record from table
const user = await usersTable.Record<User>({ where: { email: 'bob@example.com' } });

if (user) {
  console.log(`Found: ${user.values.name}`);
  
  // Update the record
  await user.Update(
    { age: 36, name: 'Robert Johnson' },
    { id: user.values.id }
  );
  
  console.log(`Updated: ${user.values.name}, Age: ${user.values.age}`);
}
```

### Working with Multiple Records

```typescript
// Get all active users
const activeUsers = await usersTable.Records<User>({
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10
});

// Update all of them
for (const user of activeUsers) {
  await user.Update(
    { lastSeen: new Date().toISOString() },
    { id: user.values.id }
  );
}

console.log(`Updated ${activeUsers.length} users`);
```

### Soft Delete with Recovery

```typescript
type Post = {
  id: number;
  title: string;
  content: string;
  deleted_at?: string;
};

const post = await postsTable.Record<Post>({ where: { id: 10 } });

if (post) {
  // Soft delete
  await post.Delete({ id: post.values.id });
  console.log(`Post soft-deleted at: ${post.values.deleted_at}`);
  
  // Restore by clearing deleted_at
  await post.Update(
    { deleted_at: null as any },
    { id: post.values.id }
  );
  console.log('Post restored!');
}
```

### Bulk Insert

```typescript
type Product = {
  id?: number;
  name: string;
  price: number;
  category: string;
};

const products = [
  { name: 'Laptop', price: 999.99, category: 'electronics' },
  { name: 'Mouse', price: 29.99, category: 'electronics' },
  { name: 'Desk', price: 299.99, category: 'furniture' }
];

const insertedProducts: Record<Product>[] = [];

for (const productData of products) {
  const product = new Record<Product>(productData, 'products');
  const inserted = await product.Insert();
  if (inserted) {
    insertedProducts.push(inserted);
  }
}

console.log(`Inserted ${insertedProducts.length} products`);
```

### API Response Example

```typescript
import express from 'express';

const app = express();

// GET endpoint returning a single record
app.get('/api/users/:id', async (req, res) => {
  const user = await usersTable.Record<User>({ 
    where: { id: parseInt(req.params.id) } 
  });
  
  if (user) {
    // Record automatically serializes to JSON
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// GET endpoint returning multiple records
app.get('/api/users', async (req, res) => {
  const users = await usersTable.Records<User>({
    where: { status: 'active' },
    limit: 50
  });
  
  // Array of records automatically serializes
  res.json(users);
});

// POST endpoint creating a new record
app.post('/api/users', async (req, res) => {
  const newUser = new Record<User>(req.body, 'users');
  const inserted = await newUser.Insert();
  
  if (inserted) {
    res.status(201).json(inserted);
  } else {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH endpoint updating a record
app.patch('/api/users/:id', async (req, res) => {
  const user = await usersTable.Record<User>({ 
    where: { id: parseInt(req.params.id) } 
  });
  
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  await user.Update(req.body, { id: user.values.id });
  res.json(user);
});

// DELETE endpoint
app.delete('/api/users/:id', async (req, res) => {
  const user = await usersTable.Record<User>({ 
    where: { id: parseInt(req.params.id) } 
  });
  
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  await user.Delete({ id: user.values.id });
  res.status(204).send();
});
```

## Automatic Timestamps

The Record class automatically handles timestamp columns if they exist in your schema:

### Auto-Update Timestamps

If your table has an `updated_at` column, it will be automatically set to the current ISO timestamp when calling `Update()`:

```typescript
type Post = {
  id: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};

const post = await postsTable.Record<Post>({ where: { id: 1 } });

if (post) {
  // updated_at is automatically set
  await post.Update({ title: 'New Title' }, { id: post.values.id });
  
  console.log(post.values.updated_at); // ISO timestamp: "2026-01-09T12:34:56.789Z"
}
```

### Soft Delete Timestamps

If your table has a `deleted_at` column, calling `Delete()` will set the timestamp instead of removing the record:

```typescript
type User = {
  id: number;
  name: string;
  email: string;
  deleted_at?: string;
};

const user = await usersTable.Record<User>({ where: { id: 1 } });

if (user) {
  // Sets deleted_at instead of removing record
  await user.Delete({ id: user.values.id });
  
  console.log(user.values.deleted_at); // ISO timestamp: "2026-01-09T12:34:56.789Z"
}
```

### Timestamp Column Names

The following column names are automatically detected:
- `updated_at` - Set on every Update() call
- `deleted_at` - Set on Delete() call (enables soft deletes)

## Best Practices

1. **Use Type Definitions**: Always define TypeScript interfaces for your records:
   ```typescript
   type User = {
     id: number;
     name: string;
     email: string;
   };
   
   const user = await table.Record<User>({ where: { id: 1 } });
   // Now you get full type safety on user.values
   ```

2. **Check for Undefined**: Records may be undefined if not found:
   ```typescript
   const user = await usersTable.Record<User>({ where: { id: 999 } });
   if (!user) {
     console.log('User not found');
     return;
   }
   // Safe to use user here
   ```

3. **Use Primary Keys for Updates/Deletes**: Always use the actual primary key:
   ```typescript
   // Good
   await user.Update({ age: 30 }, { id: user.values.id });
   
   // Bad - may update wrong record
   await user.Update({ age: 30 }, { email: user.values.email });
   ```

4. **Prefer Table Methods**: For most operations, use Table methods instead of creating Records manually:
   ```typescript
   // Preferred for queries
   const users = await usersTable.Records<User>({ where: { status: 'active' } });
   
   // Only create Record manually for insertions
   const newUser = new Record<User>({ name: 'Alice', email: 'alice@...' }, 'users');
   await newUser.Insert();
   ```

5. **Handle Soft Deletes**: Query soft-deleted records explicitly:
   ```typescript
   // Exclude soft-deleted records
   const activeUsers = await usersTable.Records<User>({
     where: { deleted_at: null }
   });
   
   // Include only soft-deleted records
   const deletedUsers = await usersTable.Records<User>({
     where: [
       { column: 'deleted_at', operator: '!=', value: null }
     ]
   });
   ```

6. **Serialize for APIs**: Records work seamlessly with JSON APIs:
   ```typescript
   res.json(user); // Automatically calls toJSON()
   ```

## Notes

- Records are immutable references - updating a record doesn't affect other references to the same database row
- The `values` property is read-only; use `Update()` to modify data
- Insert operations automatically retrieve and populate auto-generated IDs
- Compatible with both BetterSQLite3 and PostgreSQL adapters
- Records support custom `console.log()` formatting for better debugging
- Timestamp handling is automatic but requires matching column names (`updated_at`, `deleted_at`)
