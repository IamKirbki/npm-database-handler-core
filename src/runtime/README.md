# Runtime Classes

Internal runtime classes for managing database adapters and data access patterns.

## Overview

Runtime classes provide the infrastructure for managing database connections and implementing the repository pattern for Model operations.

## Classes

### [Container](Container.ts)

Singleton container for managing multiple database adapters with named instances.

**Key Features:**
- Centralized adapter management
- Support for multiple named adapters
- Automatic default adapter handling
- Singleton pattern ensures one instance per application

**Quick Example:**
```typescript
import Container from '@iamkirbki/database-handler-core';

const container = Container.getInstance();
container.registerAdapter('default', dbAdapter, true);

const adapter = container.getAdapter();
```

**See:** [Container Documentation](../../../../wiki/api/Container.md) for detailed usage and examples.

---

### [Repository](Repository.ts)

Internal repository pattern implementation for Model data access with automatic relationship handling.

**Key Features:**
- Singleton per Model class
- Automatic JOIN generation for relationships
- Internal caching of model instances
- Handles all CRUD operations for Models

**Quick Example:**
```typescript
// Used internally by Model class
class User extends Model<UserData> {
    protected tableName = 'users';
}

// Repository handles all database operations automatically
const users = await User.with('posts').all();
```

**Note:** Repository is primarily used internally by the Model class. Most developers should use the Model API directly.

**See:** [Repository Documentation](../../../../wiki/api/Repository.md) for internal implementation details.

---

## Usage

These classes work together to provide the runtime infrastructure:

```typescript
import Container from '@iamkirbki/database-handler-core';
import { Model } from '@iamkirbki/database-handler-core';

// 1. Register database adapters
const container = Container.getInstance();
container.registerAdapter('default', mainDb, true);
container.registerAdapter('analytics', analyticsDb);

// 2. Define models (Repository created automatically)
class User extends Model<UserData> {
    protected tableName = 'users';
}

class Event extends Model<EventData> {
    protected configuration = {
        table: 'events',
        customAdapter: 'analytics'
    };
}

// 3. Use models (Container and Repository work behind the scenes)
const users = await User.all();        // Uses default adapter
const events = await Event.all();      // Uses analytics adapter
```

## Documentation

For comprehensive API documentation and examples:
- [Container.md](../../../../wiki/api/Container.md) - Adapter management
- [Repository.md](../../../../wiki/api/Repository.md) - Repository pattern internals
