# Repository

Internal repository pattern implementation for managing Model data access with automatic relationship handling.

## Overview

The Repository class is an internal singleton implementation used by the Model class to handle data persistence, retrieval, and relationship management. Each Model class gets its own Repository instance that manages database operations for that model.

**Note:** This class is primarily used internally by the Model class. Most developers should use the Model API directly rather than interacting with Repository.

## Constructor

```typescript
constructor(tableName: string, ModelClass: ModelType, customAdapter?: string)
```

**Parameters:**
- `tableName` (string) - Database table name
- `ModelClass` (ModelType) - Model instance for type inference
- `customAdapter` (string, optional) - Named adapter to use

---

## Static Methods

### `getInstance<ModelType>(ModelClass, tableName, customAdapter?)`

Get or create a singleton Repository instance for a Model class.

**Parameters:**
- `ModelClass` (new () => Model<ModelType>) - Model class constructor
- `tableName` (string) - Database table name
- `customAdapter` (string, optional) - Named adapter to use

**Returns:** `Repository<ModelType, Model<ModelType>>`

```typescript
const userRepo = Repository.getInstance(User, 'users');
```

**Notes:**
- Each Model class gets exactly one Repository instance
- Subsequent calls with the same ModelClass return the cached instance
- The instance is identified by the class name

---

## Instance Methods

### `syncModel(model)`

Register or update a model instance in the repository's model cache.

**Parameters:**
- `model` (ModelType) - Model instance to sync

**Returns:** `void`

```typescript
repository.syncModel(userInstance);
```

**Notes:**
- Called automatically when setting attributes with a primary key
- Uses the model's primary key or constructor name as the cache key

---

### `getModel(name)`

Retrieve a cached model instance by name.

**Parameters:**
- `name` (string) - Model identifier (primary key or class name)

**Returns:** `ModelType`

---

### `save(attributes)`

Insert a record into the database.

**Parameters:**
- `attributes` (Type) - Record data to insert

**Returns:** `Promise<void>`

```typescript
await repository.save({
    name: 'Alice',
    email: 'alice@example.com'
});
```

---

### `first(conditions, Model)`

Retrieve the first record matching conditions, with automatic relationship loading.

**Parameters:**
- `conditions` (QueryCondition) - Where conditions
- `Model` (Model<Type>) - Model instance for relationship context

**Returns:** `Promise<Type | null>`

```typescript
const user = await repository.first({ email: 'alice@example.com' }, userModel);
```

**Notes:**
- Automatically handles JOINs if the model has loaded relationships
- Returns `null` if no record is found

---

### `get(conditions, queryOptions, Model)`

Retrieve multiple records matching conditions with pagination and ordering.

**Parameters:**
- `conditions` (QueryCondition) - Where conditions
- `queryOptions` (QueryOptions) - Limit, offset, orderBy options
- `Model` (Model<Type>) - Model instance for relationship context

**Returns:** `Promise<Type[]>`

```typescript
const users = await repository.get(
    { status: 'active' },
    { limit: 10, orderBy: 'created_at DESC' },
    userModel
);
```

---

### `all(Model, queryscopes?, queryOptions?)`

Retrieve all records, optionally filtered and paginated.

**Parameters:**
- `Model` (Model<Type>) - Model instance for relationship context
- `queryscopes` (QueryCondition, optional) - Where conditions
- `queryOptions` (QueryOptions, optional) - Limit, offset, orderBy options

**Returns:** `Promise<Type[]>`

```typescript
const allUsers = await repository.all(userModel);

const filteredUsers = await repository.all(
    userModel,
    { status: 'active' },
    { limit: 20, orderBy: 'name ASC' }
);
```

---

### `update(primaryKey, newAttributes)`

Update a record by primary key.

**Parameters:**
- `primaryKey` (QueryWhereParameters) - Primary key condition
- `newAttributes` (Partial<Type>) - Fields to update

**Returns:** `Promise<Record<Type> | undefined>`

```typescript
const updatedUser = await repository.update(
    { id: 1 },
    { name: 'Alice Smith' }
);
```

---

## Relationship Handling

The Repository automatically handles model relationships defined via `with()` on the Model class.

### Supported Relationship Types

#### Many-to-Many

```typescript
class User extends Model<UserData> {
    protected tableName = 'users';
    
    protected roles() {
        return this.ManyToMany(
            new Role(),
            'user_roles',      // Pivot table
            'id',              // Local key
            'id',              // Foreign key
            'user_id',         // Pivot foreign key
            'role_id'          // Pivot local key
        );
    }
}

const users = await User.with('roles').all();
// Generates JOINs through user_roles pivot table
```

#### Has Many

```typescript
class User extends Model<UserData> {
    protected posts() {
        return this.hasMany(
            new Post(),
            'user_id',  // Foreign key in posts table
            'id'        // Local key in users table
        );
    }
}

const users = await User.with('posts').all();
// Generates LEFT JOIN with posts table
```

#### Has One

```typescript
class User extends Model<UserData> {
    protected profile() {
        return this.hasOne(
            new Profile(),
            'id',       // Foreign key in profiles table
            'user_id'   // Local key in users table
        );
    }
}

const users = await User.with('profile').all();
// Generates INNER JOIN with profiles table
```

#### Belongs To

```typescript
class Post extends Model<PostData> {
    protected author() {
        return this.belongsTo(
            new User(),
            'user_id',  // Foreign key in posts table
            'id'        // Local key in users table
        );
    }
}

const posts = await Post.with('author').all();
// Generates INNER JOIN with users table
```

---

## Internal Implementation Details

### Model Caching

The Repository maintains a cache of model instances:

```typescript
private models: Map<string, ModelType> = new Map();
```

- Models are keyed by primary key value or class name
- Enables model reuse and reference tracking
- Automatically synced when attributes are set

### Singleton Management

```typescript
private static _instances: Map<string, Repository<columnType, Model<columnType>>> = new Map();
```

- One Repository per Model class
- Identified by Model class name
- Ensures consistent data access patterns

### Automatic JOIN Generation

When a Model has loaded relationships (`with()`), the Repository automatically:

1. Detects the relationship type from Model.Relations
2. Builds appropriate JOIN objects
3. Merges query scopes from relationships
4. Executes the JOIN query via Table.Join()
5. Returns flattened results

```typescript
// Internally transforms:
await User.with('posts').where({ status: 'active' }).all();

// Into:
await Table.Join([{
    fromTable: 'posts',
    joinType: 'LEFT',
    on: [{ user_id: 'id' }]
}], {
    where: { 'users.status': 'active' },
    ...queryOptions
});
```

---

## Usage Through Model API

Most developers interact with Repository indirectly through the Model API:

```typescript
class User extends Model<UserData> {
    protected tableName = 'users';
}

// These Model methods use Repository internally:

// Find operations
const user = await User.find(1).first();
const users = await User.where({ status: 'active' }).get();
const all = await User.all();

// Save operations
const newUser = new User();
newUser.set({ name: 'Alice' });
await newUser.save(); // Uses repository.save()

// Update operations
user.set({ name: 'Alice Smith' });
await user.save(); // Uses repository.update()

// With relationships
const usersWithPosts = await User.with('posts').all();
// Uses repository.all() with automatic JOIN handling
```

---

## Advanced Examples

### Custom Adapter

```typescript
// Repository automatically uses the model's custom adapter
class AnalyticsEvent extends Model<EventData> {
    protected configuration = {
        table: 'events',
        customAdapter: 'analytics'
    };
}

// All operations use the 'analytics' adapter
const events = await AnalyticsEvent.all();
```

### Multiple Relationships

```typescript
class Post extends Model<PostData> {
    protected author() {
        return this.belongsTo(new User(), 'user_id', 'id');
    }
    
    protected comments() {
        return this.hasMany(new Comment(), 'post_id', 'id');
    }
    
    protected tags() {
        return this.ManyToMany(new Tag(), 'post_tags', 'id', 'id', 'post_id', 'tag_id');
    }
}

// Load multiple relationships
const posts = await Post
    .with('author')
    .with('comments')
    .with('tags')
    .all();

// Repository generates all necessary JOINs automatically
```

### Query Scopes on Relationships

```typescript
// Apply conditions to related models
const posts = await Post
    .with('comments', { approved: true })
    .with('author', { status: 'active' })
    .where({ published: true })
    .all();

// Repository merges all query conditions:
// - posts.published = true
// - comments.approved = true  
// - users.status = 'active'
```

### Pagination with Relationships

```typescript
const posts = await Post
    .with('author')
    .where({ published: true })
    .orderBy('created_at', 'DESC')
    .limit(20)
    .offset(0)
    .get();

// Repository passes queryOptions through to Table.Join()
```

---

## Performance Considerations

### Eager Loading

Loading relationships with `with()` uses JOINs, which can be more efficient than separate queries:

```typescript
// Efficient: Single query with JOIN
const users = await User.with('posts').all();

// Less efficient: N+1 query problem
const users = await User.all();
for (const user of users) {
    const posts = await Post.where({ user_id: user.id }).get();
}
```

### Selective Loading

Only load relationships you need:

```typescript
// Good: Only load required relationships
const users = await User.with('profile').all();

// Avoid: Loading unnecessary data
const users = await User
    .with('profile')
    .with('posts')
    .with('comments')
    .with('followers')
    .all();
```

### Pagination

Use limit/offset for large datasets:

```typescript
const pageSize = 50;
const page = 2;

const users = await User
    .orderBy('created_at', 'DESC')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
```

---

## See Also

- [Model](../../abstract/Wiki/Model.md) - Abstract Model class documentation
- [Table](../../base/Wiki/Table.md) - Underlying Table operations
- [Record](../../base/Wiki/Record.md) - Single record operations
- [Container](Container.md) - Adapter management
