# Schema Builder

## Introduction

The Schema Builder provides a fluent API for creating and modifying database tables. Use it through the `createTable` and `alterTable` methods on your database adapter.

```typescript
await db.createTable('users', (table) => {
    table.integer('id').primaryKey().increments();
    table.string('email').unique();
    table.timestamps();
});
```

## Creating Tables

Use `createTable` to create a new table:

```typescript
await db.createTable('users', (table) => {
    table.integer('id').primaryKey().increments();
    table.string('username', 50).unique();
    table.string('email', 100).unique();
    table.boolean('is_active').defaultTo(true);
    table.timestamps();
});
```

## Updating Tables

Use `alterTable` to add columns to an existing table:

```typescript
await db.alterTable('users', (table) => {
    table.string('phone_number', 20).nullable();
    table.integer('role_id').foreignKey('roles', 'id');
});
```

## Column Types

### String & Text

```typescript
table.string('name', 100);       // VARCHAR(100)
table.string('description');     // VARCHAR
table.text('content');           // TEXT
table.uuid('uuid');              // UUID
```

### Numbers

```typescript
table.integer('votes');          // INTEGER
table.decimal('price', 10, 2);   // DECIMAL(10,2)
table.float('rating');           // REAL
```

### Dates & Times

```typescript
table.timestamp('created_at');   // TIMESTAMP / DATETIME
table.time('start_time');        // TIME / TEXT (SQLite)
```

### Other Types

```typescript
table.boolean('is_active');      // BOOLEAN
table.json('metadata');          // JSONB (PostgreSQL) / TEXT (SQLite)
table.enum('status', ['pending', 'active', 'inactive']);
```

## Column Modifiers

Chain modifiers after column definitions:

```typescript
table.string('email').unique();
table.string('bio').nullable();
table.boolean('is_active').defaultTo(true);
table.integer('id').primaryKey().increments();
table.integer('user_id').foreignKey('users', 'id');
```

### Available Modifiers

| Modifier | Description |
|----------|-------------|
| `.primaryKey()` | Set as primary key |
| `.increments()` | Auto-incrementing |
| `.unique()` | Add unique constraint |
| `.nullable()` | Allow NULL values |
| `.defaultTo(value)` | Set default value |
| `.foreignKey(table, column)` | Add foreign key |

## Helper Methods

### timestamps()

Adds `created_at` and `updated_at` columns:

```typescript
table.timestamps();
// created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### softDeletes()

Adds a nullable `deleted_at` column for soft deletes:

```typescript
table.softDeletes();
// deleted_at TIMESTAMP NULLABLE
```

### morphs(name)

Creates polymorphic relationship columns:

```typescript
table.morphs('commentable');
// commentable_id INTEGER
// commentable_type VARCHAR
```

## Example: Complete Table

```typescript
await db.createTable('posts', (table) => {
    table.integer('id').primaryKey().increments();
    table.string('title', 200);
    table.text('content');
    table.enum('status', ['draft', 'published']).defaultTo('draft');
    table.integer('user_id').foreignKey('users', 'id');
    table.timestamps();
    table.softDeletes();
});
```

## Database Differences

| Feature | PostgreSQL | SQLite |
|---------|-----------|---------|
| Auto-increment | `SERIAL` | `AUTO_INCREMENT` |
| JSON | `JSONB` (native) | `TEXT` |
| Time | `TIME` (native) | `TEXT` |
| Foreign Key | `REFERENCES` | `FOREIGN KEY() REFERENCES` |
