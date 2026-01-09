# Record

## Introduction

Represents a single database row with methods for CRUD operations and serialization.

```typescript
const user = new Record<User>('users', {
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
});

await user.Insert();
```

## Creating Records

```typescript
// For insertion
const newUser = new Record<User>('users', {
  name: 'Bob',
  email: 'bob@example.com'
});

// With named adapter
const event = new Record('events', {
  name: 'user_login',
  timestamp: new Date()
}, 'analytics');
```

### Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Table name |
| `values` | object | Column values |
| `adapter` | string | Named adapter (optional) |

## Accessing Values

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

console.log(user.values.name);    // 'Alice'
console.log(user.values.email);   // 'alice@example.com'
```

## Methods

### Insert()

Insert the record into the database and update with auto-generated values.

```typescript
const user = new Record<User>('users', {
  name: 'Alice',
  email: 'alice@example.com'
});

await user.Insert();
// user.values now includes: { id: 1, name: 'Alice', email: 'alice@example.com' }
```

### Update()

Update the record in the database (requires primary key).

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });
user.values.name = 'Alice Smith';
user.values.email = 'alice.smith@example.com';

await user.Update();
```

### Delete()

Delete the record from the database.

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

// Hard delete
await user.Delete();

// Soft delete (if deleted_at column exists)
await user.Delete(true);
```

### toJSON()

Convert the record to a plain JavaScript object.

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });
const jsonData = user.toJSON();
// Returns: { id: 1, name: 'Alice', email: 'alice@example.com' }

// Use in API responses
return Response.json(user.toJSON());
```

### toString()

Convert the record to a JSON string.

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });
const str = user.toString();
// Returns: '{"id":1,"name":"Alice","email":"alice@example.com"}'
```

## Automatic Timestamps

### created_at & updated_at

Automatically managed if columns exist:

```typescript
const post = new Record<Post>('posts', {
  title: 'Hello World',
  content: 'First post'
});

await post.Insert();
// created_at and updated_at automatically set

post.values.title = 'Hello TypeScript';
await post.Update();
// updated_at automatically updated
```

### Soft Deletes

Use `deleted_at` column for soft deletion:

```typescript
const user = await usersTable.Record<User>({ where: { id: 1 } });

await user.Delete(true);  // Sets deleted_at to current timestamp
// User still exists in database but marked as deleted
```

## Examples

### Create and Insert

```typescript
const product = new Record<Product>('products', {
  name: 'Laptop',
  price: 999.99,
  stock: 50
});

await product.Insert();
console.log(product.values.id);  // Auto-generated ID
```

### Fetch, Modify, Update

```typescript
const user = await usersTable.Record<User>({ where: { email: 'alice@example.com' } });

if (user) {
  user.values.last_login = new Date();
  await user.Update();
}
```

### Conditional Delete

```typescript
const post = await postsTable.Record<Post>({ where: { id: postId } });

if (post && post.values.status === 'draft') {
  await post.Delete();
}
```

### API Response

```typescript
// Express route
app.get('/api/users/:id', async (req, res) => {
  const user = await usersTable.Record<User>({
    where: { id: req.params.id }
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user.toJSON());
});
```

### Bulk Operations

```typescript
const users = await usersTable.Records<User>({
  where: { status: 'pending' }
});

for (const user of users) {
  user.values.status = 'active';
  user.values.activated_at = new Date();
  await user.Update();
}
```

### Working with Relationships

```typescript
const post = await postsTable.Record<Post>({ where: { id: 1 } });

if (post) {
  // Get author
  const author = await usersTable.Record<User>({
    where: { id: post.values.user_id }
  });
  
  // Get comments
  const comments = await commentsTable.Records<Comment>({
    where: { post_id: post.values.id }
  });
}
```
