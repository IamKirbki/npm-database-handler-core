# Container

Singleton container for managing multiple database adapters with named instances.

## Overview

The Container class follows the singleton pattern and provides centralized management of database adapters. It allows you to register multiple database connections and retrieve them by name or use a default adapter.

## Methods

### `getInstance()`

Get the singleton instance of the Container.

**Returns:** `Container`

```typescript
import Container from '@iamkirbki/database-handler-core';

const container = Container.getInstance();
```

---

### `registerAdapter(name, adapter, isDefault?)`

Register a database adapter with a name.

**Parameters:**
- `name` (string) - Unique name for the adapter
- `adapter` (IDatabaseAdapter) - Database adapter instance
- `isDefault` (boolean, optional) - Whether this should be the default adapter (default: false)

**Returns:** `void`

```typescript
import Container from '@iamkirbki/database-handler-core';
import { PostgresAdapter } from '@iamkirbki/database-handler-pg';
import { BetterSqlite3Adapter } from '@iamkirbki/database-handler-bettersqlite3';

const container = Container.getInstance();

// Register default adapter
const mainDb = new PostgresAdapter();
await mainDb.connect({ host: 'localhost', database: 'myapp' });
container.registerAdapter('main', mainDb, true);

// Register additional adapter
const analyticsDb = new BetterSqlite3Adapter('analytics.db');
container.registerAdapter('analytics', analyticsDb);
```

**Notes:**
- If `isDefault` is true, or if no default adapter has been set yet, this adapter becomes the default
- Setting a new default adapter will log a warning if one already exists
- The first adapter registered automatically becomes the default if `isDefault` is not specified

---

### `getAdapter(name?)`

Retrieve a registered adapter by name, or get the default adapter.

**Parameters:**
- `name` (string, optional) - Name of the adapter to retrieve

**Returns:** `IDatabaseAdapter`

**Throws:**
- Error if named adapter is not found
- Error if no default adapter is set and no name is provided

```typescript
// Get default adapter
const defaultDb = container.getAdapter();

// Get named adapter
const analyticsDb = container.getAdapter('analytics');
```

---

## Usage Examples

### Single Database Setup

```typescript
import Container from '@iamkirbki/database-handler-core';
import { PostgresAdapter } from '@iamkirbki/database-handler-pg';

const container = Container.getInstance();
const db = new PostgresAdapter();

await db.connect({
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'postgres',
    password: 'secret'
});

// Register as default adapter
container.registerAdapter('default', db, true);

// All tables will use this adapter by default
const usersTable = new Table('users');
```

---

### Multiple Database Setup

```typescript
import Container from '@iamkirbki/database-handler-core';
import { PostgresAdapter } from '@iamkirbki/database-handler-pg';
import { BetterSqlite3Adapter } from '@iamkirbki/database-handler-bettersqlite3';

const container = Container.getInstance();

// Main database (PostgreSQL)
const mainDb = new PostgresAdapter();
await mainDb.connect({
    host: 'localhost',
    database: 'production'
});
container.registerAdapter('main', mainDb, true);

// Analytics database (SQLite)
const analyticsDb = new BetterSqlite3Adapter('./analytics.db');
container.registerAdapter('analytics', analyticsDb);

// Cache database (SQLite)
const cacheDb = new BetterSqlite3Adapter('./cache.db');
container.registerAdapter('cache', cacheDb);

// Use specific adapters
const usersTable = new Table('users'); // Uses default 'main'
const eventsTable = new Table('events', 'analytics'); // Uses 'analytics'
const sessionsTable = new Table('sessions', 'cache'); // Uses 'cache'
```

---

### Environment-Based Configuration

```typescript
import Container from '@iamkirbki/database-handler-core';

const container = Container.getInstance();

// Development: Use SQLite
if (process.env.NODE_ENV === 'development') {
    const db = new BetterSqlite3Adapter('dev.db');
    container.registerAdapter('default', db, true);
}

// Production: Use PostgreSQL
if (process.env.NODE_ENV === 'production') {
    const db = new PostgresAdapter();
    await db.connect({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });
    container.registerAdapter('default', db, true);
}
```

---

### Accessing Adapters in Application Code

```typescript
import Container from '@iamkirbki/database-handler-core';
import { Table, Query } from '@iamkirbki/database-handler-core';

// Get adapter directly if needed
const container = Container.getInstance();
const mainDb = container.getAdapter(); // Default adapter
const analyticsDb = container.getAdapter('analytics');

// Or let Table/Query handle it automatically
const usersTable = new Table('users'); // Uses default adapter

// Specify adapter by name
const metricsTable = new Table('metrics', 'analytics');

// Raw queries with specific adapter
const query = new Query({
    tableName: 'logs',
    query: 'SELECT * FROM logs WHERE created_at > @date',
    parameters: { date: '2024-01-01' },
    adapterName: 'analytics'
});
```

---

### Testing with Mock Adapters

```typescript
import Container from '@iamkirbki/database-handler-core';

class MockAdapter implements IDatabaseAdapter {
    async query() { return []; }
    async get() { return undefined; }
    async run() { }
    async close() { }
}

const container = Container.getInstance();
const mockDb = new MockAdapter();
container.registerAdapter('test', mockDb, true);

// Now all operations use the mock adapter
```

---

## Singleton Pattern

The Container uses the singleton pattern, ensuring only one instance exists:

```typescript
const container1 = Container.getInstance();
const container2 = Container.getInstance();

console.log(container1 === container2); // true
```

---

## Error Handling

```typescript
const container = Container.getInstance();

// Error: No default adapter set
try {
    const adapter = container.getAdapter();
} catch (error) {
    console.error(error.message); // "No default adapter set"
}

// Error: Adapter not found
try {
    const adapter = container.getAdapter('nonexistent');
} catch (error) {
    console.error(error.message); // "Adapter 'nonexistent' not found"
}
```

---

## Best Practices

### 1. Initialize Early

Register adapters during application startup:

```typescript
// app.ts
import Container from '@iamkirbki/database-handler-core';

async function initializeDatabase() {
    const container = Container.getInstance();
    const db = new PostgresAdapter();
    await db.connect(config);
    container.registerAdapter('default', db, true);
}

await initializeDatabase();
```

### 2. Use Named Adapters for Separation

Separate concerns by using different adapters:

```typescript
container.registerAdapter('app', appDb, true);       // Application data
container.registerAdapter('analytics', analyticsDb); // Analytics/metrics
container.registerAdapter('cache', cacheDb);         // Temporary cache
container.registerAdapter('logs', logsDb);           // Application logs
```

### 3. Graceful Shutdown

Close all connections on application exit:

```typescript
process.on('SIGTERM', async () => {
    const container = Container.getInstance();
    await container.getAdapter('main').close();
    await container.getAdapter('analytics').close();
    process.exit(0);
});
```

---

## See Also

- [Repository](Repository.md) - Repository pattern for model data access
- [IDatabaseAdapter](../../interfaces/Wiki/IDatabaseAdapter.md) - Adapter interface
- [Table](../../base/Wiki/Table.md) - High-level table operations
