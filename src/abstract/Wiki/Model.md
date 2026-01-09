# Model

## Introduction

Abstract base class for creating ORM-style models with automatic CRUD operations, relationships, and query building.

> **Note:** Models provide a high-level abstraction over tables with chainable query methods and relationship definitions.

```typescript
class User extends Model<UserData> {
    protected configuration = {
        table: 'users',
        primaryKey: 'id'
    };
}

const user = await User.find(1).first();
console.log(user.values.name);
```

## Creating Models

```typescript
import { Model } from '@iamkirbki/database-handler-core';

type UserData = {
    id: number;
    name: string;
    email: string;
    created_at: string;
};

class User extends Model<UserData> {
    protected configuration = {
        table: 'users',
        primaryKey: 'id',
        timestamps: true,
        createdAtColumn: 'created_at',
        updatedAtColumn: 'updated_at'
    };
    
    // Custom methods
    getDisplayName(): string {
        return this.values.name.toUpperCase();
    }
}
```

### Configuration Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `table` | string | (required) | Table name |
| `primaryKey` | string | `'id'` | Primary key column |
| `incrementing` | boolean | `true` | Auto-incrementing primary key |
| `keyType` | string | `'number'` | Primary key type |
| `timestamps` | boolean | `true` | Auto-manage created/updated timestamps |
| `createdAtColumn` | string | `'created_at'` | Created timestamp column |
| `updatedAtColumn` | string | `'updated_at'` | Updated timestamp column |
| `customAdapter` | string | `undefined` | Named adapter to use |

## Static Query Methods

All static methods return model instances with chainable query builders.

### find()

Find record by primary key value.

```typescript
const user = await User.find(1).first();

// Chainable
const activeUser = await User.find(1)
    .where({ status: 'active' })
    .first();
```

### where()

Query with conditions.

```typescript
// Simple conditions
const users = await User.where({ status: 'active' }).get();

// Multiple conditions
const users = await User.where({ 
    status: 'active', 
    role: 'admin' 
}).get();

// Advanced conditions
const users = await User.where([
    { column: 'age', operator: '>', value: 18 },
    { column: 'status', operator: '=', value: 'active' }
]).get();
```

### all()

Fetch all records.

```typescript
const users = await User.all();
// Returns: User[] instances
```

### first()

Fetch first record (optionally by primary key).

```typescript
// First record in table
const user = await User.first();

// By primary key
const user = await User.first(1);

// With conditions
const user = await User.where({ email: 'alice@example.com' }).first();
```

### limit()

Limit number of results.

```typescript
const users = await User.limit(10).get();

// With conditions
const recentUsers = await User
    .where({ status: 'active' })
    .orderBy('created_at', 'DESC')
    .limit(5)
    .get();
```

### offset()

Skip records (requires limit).

```typescript
// Pagination
const page2 = await User.limit(10).offset(10).get();
```

### orderBy()

Sort results.

```typescript
// Ascending (default)
const users = await User.orderBy('name').get();

// Descending
const users = await User.orderBy('created_at', 'DESC').get();
```

### set()

Create new model instance with attributes.

```typescript
const user = User.set({
    name: 'Alice',
    email: 'alice@example.com'
});

await user.save();
```

## Instance Methods

### set()

Set attribute values on instance.

```typescript
const user = new User();
user.set({
    name: 'Bob',
    email: 'bob@example.com'
});

await user.save();
```

### save()

Insert new record or update existing.

```typescript
// Insert new
const user = new User();
user.set({ name: 'Charlie' });
await user.save();

// Update existing
const user = await User.find(1).first();
user.set({ name: 'Charlie Updated' });
await user.save();
```

### update()

Update existing record with new attributes.

```typescript
const user = await User.find(1).first();
await user.update({ 
    name: 'Updated Name',
    email: 'updated@example.com' 
});

console.log(user.values.name); // "Updated Name"
```

### get()

Execute query and return array of model instances.

```typescript
// All active users
const users = await User.where({ status: 'active' }).get();

users.forEach(user => {
    console.log(user.values.name);
});
```

### first()

Execute query and return first model instance.

```typescript
const user = await User
    .where({ email: 'alice@example.com' })
    .first();

if (user.exists) {
    console.log(user.values.name);
}
```

### findOrFail()

Find record or throw error if not found.

```typescript
try {
    const user = await User.findOrFail(999);
} catch (error) {
    console.error('User not found');
}
```

## Properties

### values

Access model attributes.

```typescript
const user = await User.find(1).first();

console.log(user.values.name);
console.log(user.values.email);

// Update values
user.values.name = 'New Name';
await user.save();
```

### exists

Check if model exists in database.

```typescript
const user = new User();
console.log(user.exists); // false

user.set({ name: 'Alice' });
await user.save();
console.log(user.exists); // true
```

### primaryKey

Get primary key value.

```typescript
const user = await User.find(1).first();
console.log(user.primaryKey); // 1
```

### primaryKeyColumn

Get primary key column name.

```typescript
const user = new User();
console.log(user.primaryKeyColumn); // "id"
```

## Relationships

Define relationships between models.

### hasMany()

One-to-many relationship.

```typescript
class User extends Model<UserData> {
    protected configuration = { table: 'users' };
    
    posts() {
        return this.hasMany(new Post());
    }
}

const user = await User.find(1).with('posts').first();
console.log(user.JoinedEntities);
```

### hasOne()

One-to-one relationship.

```typescript
class User extends Model<UserData> {
    protected configuration = { table: 'users' };
    
    profile() {
        return this.hasOne(new Profile());
    }
}
```

### belongsTo()

Inverse one-to-many relationship.

```typescript
class Post extends Model<PostData> {
    protected configuration = { table: 'posts' };
    
    user() {
        return this.belongsTo(new User());
    }
}
```

### ManyToMany()

Many-to-many relationship through pivot table.

```typescript
class User extends Model<UserData> {
    protected configuration = { table: 'users' };
    
    roles() {
        return this.ManyToMany(
            new Role(),
            'user_roles',      // pivot table
            'id',              // local key
            'id',              // foreign key
            'user_id',         // pivot local key
            'role_id'          // pivot foreign key
        );
    }
}
```

### with()

Eager load relationships.

```typescript
// Load single relationship
const user = await User.find(1).with('posts').first();

// Load with conditions
const user = await User.find(1)
    .with('posts', { status: 'published' })
    .first();

// Access loaded relationships
console.log(user.JoinedEntities);
```

## Query Chaining

Combine multiple query methods.

```typescript
// Complex query
const users = await User
    .where({ status: 'active' })
    .orderBy('created_at', 'DESC')
    .limit(10)
    .offset(20)
    .get();

// With relationships
const users = await User
    .where({ role: 'admin' })
    .with('posts', { published: true })
    .with('profile')
    .get();
```

## Helper Methods

### toJSON()

Convert model to JSON object.

```typescript
const user = await User.find(1).first();
const json = user.toJSON();
console.log(json); // { id: 1, name: "Alice", email: "alice@example.com" }
```

### toObject()

Convert model to plain object (alias for toJSON).

```typescript
const user = await User.find(1).first();
const obj = user.toObject();
```

## Complete Example

```typescript
import { Model } from '@iamkirbki/database-handler-core';

// Define types
type UserData = {
    id: number;
    name: string;
    email: string;
    role: string;
    created_at: string;
};

type PostData = {
    id: number;
    user_id: number;
    title: string;
    content: string;
};

// Create models
class User extends Model<UserData> {
    protected configuration = {
        table: 'users',
        primaryKey: 'id',
        timestamps: true
    };
    
    posts() {
        return this.hasMany(new Post(), 'user_id', 'id');
    }
    
    getDisplayName(): string {
        return `${this.values.name} (${this.values.role})`;
    }
}

class Post extends Model<PostData> {
    protected configuration = {
        table: 'posts',
        primaryKey: 'id'
    };
    
    user() {
        return this.belongsTo(new User(), 'user_id', 'id');
    }
}

// Usage

// Create new user
const user = User.set({
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin'
});
await user.save();

// Find and update
const alice = await User.where({ email: 'alice@example.com' }).first();
alice.set({ role: 'super_admin' });
await alice.save();

// Query with relationships
const admins = await User
    .where({ role: 'super_admin' })
    .with('posts', { published: true })
    .orderBy('created_at', 'DESC')
    .limit(10)
    .get();

admins.forEach(admin => {
    console.log(admin.getDisplayName());
    console.log('Posts:', admin.JoinedEntities);
});

// Pagination
const page1 = await User.limit(20).get();
const page2 = await User.limit(20).offset(20).get();

// Complex queries
const recentActiveUsers = await User
    .where([
        { column: 'status', operator: '=', value: 'active' },
        { column: 'created_at', operator: '>', value: '2024-01-01' }
    ])
    .with('posts')
    .orderBy('created_at', 'DESC')
    .limit(50)
    .get();
```

## Error Handling

```typescript
// findOrFail throws on missing record
try {
    const user = await User.findOrFail(999);
} catch (error) {
    console.error('User not found');
}

// update() requires existing record
const newUser = new User();
try {
    await newUser.update({ name: 'Test' });
} catch (error) {
    console.error('Cannot update non-existent record');
}

// offset() requires limit()
try {
    await User.offset(10).get();
} catch (error) {
    console.error('Offset requires limit');
}
```

## See Also

- [Table](../../base/Wiki/Table.md) - High-level table operations
- [Record](../../base/Wiki/Record.md) - Single row operations
- [Query](../../base/Wiki/Query.md) - Raw SQL queries
- [Repository](../../runtime/wiki/Repository.md) - Internal repository pattern
