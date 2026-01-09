# Table

## Introduction

High-level interface for interacting with database tables without writing raw SQL.

```typescript
const usersTable = new Table('users');
const users = await usersTable.Records<User>({ 
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10
});
```

## Creating Tables

```typescript
const usersTable = new Table('users');
const postsTable = new Table('posts');

// With named adapter
const analyticsTable = new Table('events', 'analytics');
```

## Querying Records

### Records()

Fetch multiple records with filtering, ordering, and pagination.

```typescript
// All records
const allUsers = await usersTable.Records<User>();

// Filtered
const activeUsers = await usersTable.Records<User>({
  where: { status: 'active' }
});

// With ordering
const recentUsers = await usersTable.Records<User>({
  orderBy: 'created_at DESC',
  limit: 10
});

// Pagination
const page2 = await usersTable.Records<User>({
  limit: 20,
  offset: 20
});

// Complex filters
const results = await usersTable.Records<User>({
  where: [
    { column: 'age', operator: '>', value: 18 },
    { column: 'status', operator: '=', value: 'active' }
  ],
  orderBy: 'name ASC'
});
```

### Record()

Fetch a single record.

```typescript
const user = await usersTable.Record<User>({ 
  where: { id: 1 } 
});

if (user) {
  console.log(user.values.name);
}
```

### RecordsCount()

Count records matching criteria.

```typescript
// All records
const total = await usersTable.RecordsCount();

// Filtered
const activeCount = await usersTable.RecordsCount({
  where: { status: 'active' }
});
```

## Inserting Data

### Insert()

Insert a single record or multiple records.

```typescript
// Single record
await usersTable.Insert({
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
});

// Multiple records
await usersTable.Insert([
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);
```

## JOIN Operations

Perform JOIN queries with automatic result splitting.

```typescript
const results = await usersTable.Join<User, Post>({
  joinTable: 'posts',
  joinType: 'INNER',
  on: 'users.id = posts.user_id',
  where: { 'posts.status': 'published' },
  select: 'users.*, posts.title, posts.created_at as post_date'
});

// Access joined data
results.forEach(([user, post]) => {
  console.log(user.values.name);
  console.log(post.values.title);
});
```

### JOIN Types

```typescript
// INNER JOIN
await usersTable.Join({ joinTable: 'posts', joinType: 'INNER', on: 'users.id = posts.user_id' });

// LEFT JOIN
await usersTable.Join({ joinTable: 'profiles', joinType: 'LEFT', on: 'users.id = profiles.user_id' });

// RIGHT JOIN
await usersTable.Join({ joinTable: 'orders', joinType: 'RIGHT', on: 'users.id = orders.user_id' });

// FULL JOIN
await usersTable.Join({ joinTable: 'sessions', joinType: 'FULL', on: 'users.id = sessions.user_id' });
```

## Table Information

### TableColumnInformation()

Get raw column metadata from the database.

```typescript
const columns = await usersTable.TableColumnInformation();
// Returns: [{ name: 'id', type: 'INTEGER', ... }, ...]
```

### ReadableTableColumnInformation()

Get formatted, human-readable column information.

```typescript
const columns = await usersTable.ReadableTableColumnInformation();
console.log(columns);
// {
//   id: { type: 'INTEGER', nullable: false, primaryKey: true },
//   name: { type: 'VARCHAR(50)', nullable: false },
//   email: { type: 'VARCHAR(100)', nullable: false, unique: true }
// }
```

## Drop Table

```typescript
await usersTable.Drop();
// Table removed from database
```

## Examples

### Pagination

```typescript
const pageSize = 20;
const pageNumber = 2;

const users = await usersTable.Records<User>({
  limit: pageSize,
  offset: (pageNumber - 1) * pageSize,
  orderBy: 'id ASC'
});

const totalCount = await usersTable.RecordsCount();
const totalPages = Math.ceil(totalCount / pageSize);
```

### Search and Filter

```typescript
const searchResults = await usersTable.Records<User>({
  where: [
    { column: 'name', operator: 'LIKE', value: '%John%' },
    { column: 'status', operator: '=', value: 'active' }
  ],
  orderBy: 'name ASC'
});
```

### Recent Items

```typescript
const recentPosts = await postsTable.Records<Post>({
  where: { status: 'published' },
  orderBy: 'created_at DESC',
  limit: 10
});
```

### Bulk Insert

```typescript
const newUsers = [
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' },
  { name: 'User 3', email: 'user3@example.com' }
];

await usersTable.Insert(newUsers);
```

### Conditional Queries

```typescript
async function getUsers(filters: any) {
  const options: any = {};
  
  if (filters.status) {
    options.where = { status: filters.status };
  }
  
  if (filters.sortBy) {
    options.orderBy = `${filters.sortBy} ${filters.sortDir || 'ASC'}`;
  }
  
  if (filters.limit) {
    options.limit = filters.limit;
    options.offset = filters.offset || 0;
  }
  
  return await usersTable.Records<User>(options);
}
```

### JOIN with Filtering

```typescript
const userPosts = await usersTable.Join<User, Post>({
  joinTable: 'posts',
  joinType: 'LEFT',
  on: 'users.id = posts.user_id',
  where: { 'users.status': 'active' },
  orderBy: 'posts.created_at DESC'
});

// Process results
userPosts.forEach(([user, post]) => {
  if (post) {
    console.log(`${user.values.name} wrote: ${post.values.title}`);
  } else {
    console.log(`${user.values.name} has no posts`);
  }
});
```

### Multiple JOINs

```typescript
// First JOIN
const userPosts = await usersTable.Join<User, Post>({
  joinTable: 'posts',
  joinType: 'INNER',
  on: 'users.id = posts.user_id'
});

// Then process to get comments
for (const [user, post] of userPosts) {
  const comments = await commentsTable.Records<Comment>({
    where: { post_id: post.values.id }
  });
  
  console.log(`Post "${post.values.title}" has ${comments.length} comments`);
}
```
