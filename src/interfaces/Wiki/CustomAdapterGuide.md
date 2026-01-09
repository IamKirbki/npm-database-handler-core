# Creating Custom Adapter Packages

Complete guide for developers creating database adapter packages for the Kirbkis Database Handler.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Package Structure](#package-structure)
- [Implementation Guide](#implementation-guide)
  - [1. Database Adapter](#1-database-adapter)
  - [2. Statement Adapter](#2-statement-adapter)
  - [3. Schema Builder](#3-schema-builder)
- [Parameter Conversion](#parameter-conversion)
- [Testing Your Adapter](#testing-your-adapter)
- [Publishing Your Package](#publishing-your-package)
- [Real-World Examples](#real-world-examples)

---

## Overview

The Kirbkis Database Handler uses a plugin architecture. Any database can be integrated by implementing three core interfaces:

1. **IDatabaseAdapter** - Connection management and query preparation
2. **IStatementAdapter** - Query execution and result handling
3. **AbstractSchemaBuilder** - Schema creation and modification

---

## Quick Start

### Prerequisites

```bash
npm install @iamkirbki/database-handler-core
npm install your-database-library
```

### Minimal Implementation

```typescript
// MyDatabaseAdapter.ts
import { IDatabaseAdapter, IStatementAdapter } from '@iamkirbki/database-handler-core';
import MyDatabaseStatement from './MyDatabaseStatement';

export default class MyDatabaseAdapter implements IDatabaseAdapter {
    private connection: any = null;

    async connect(params: unknown): Promise<void> {
        this.connection = await createConnection(params);
    }

    async prepare(query: string): Promise<IStatementAdapter> {
        const stmt = await this.connection.prepare(query);
        return new MyDatabaseStatement(stmt);
    }

    async exec(query: string): Promise<void> {
        await this.connection.execute(query);
    }

    async transaction(fn: (items: any[]) => void): Promise<Function> {
        await this.connection.beginTransaction();
        try {
            fn([]);
            return async () => await this.connection.commit();
        } catch (error) {
            await this.connection.rollback();
            throw error;
        }
    }

    async tableColumnInformation(tableName: string): Promise<any[]> {
        // Query your database's information schema
        const result = await this.connection.query(
            `SELECT * FROM information_schema.columns WHERE table_name = ?`,
            [tableName]
        );
        
        return result.map((col: any, index: number) => ({
            cid: index,
            name: col.column_name,
            type: col.data_type,
            notnull: col.is_nullable === 'NO' ? 1 : 0,
            dflt_value: col.column_default,
            pk: col.column_key === 'PRI' ? 1 : 0
        }));
    }

    async close(): Promise<void> {
        await this.connection?.close();
        this.connection = null;
    }
}
```

```typescript
// MyDatabaseStatement.ts
import { IStatementAdapter, RunResult } from '@iamkirbki/database-handler-core';

export default class MyDatabaseStatement implements IStatementAdapter {
    private statement: any;

    constructor(statement: any) {
        this.statement = statement;
    }

    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const result = await this.statement.execute(parameters);
        return {
            changes: result.affectedRows,
            lastInsertRowid: result.insertId
        };
    }

    async all(parameters?: Record<string, any>): Promise<any[]> {
        return await this.statement.execute(parameters);
    }

    async get(parameters?: Record<string, any>): Promise<any> {
        const results = await this.statement.execute(parameters);
        return results[0];
    }
}
```

---

## Package Structure

Create your adapter package with this structure:

```
my-database-adapter/
├── package.json
├── tsconfig.json
├── README.md
├── LISCENSE
├── src/
│   ├── index.ts
│   ├── MyDatabaseAdapter.ts
│   ├── MyDatabaseStatement.ts
│   ├── MyDatabaseSchemaBuilder.ts
│   └── MyDatabaseTableSchemaBuilder.ts
└── tests/
    ├── adapter.test.ts
    ├── statement.test.ts
    └── schema.test.ts
```

### package.json

```json
{
  "name": "@yourorg/database-handler-mydatabase",
  "version": "1.0.0",
  "description": "MyDatabase adapter for Kirbkis Database Handler",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "keywords": [
    "database",
    "mydatabase",
    "kirbkis",
    "adapter"
  ],
  "peerDependencies": {
    "@iamkirbki/database-handler-core": "^1.0.0"
  },
  "dependencies": {
    "your-database-library": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### index.ts

```typescript
export { default as MyDatabaseAdapter } from './MyDatabaseAdapter.js';
export { default as MyDatabaseStatement } from './MyDatabaseStatement.js';
export { default as MyDatabaseSchemaBuilder } from './MyDatabaseSchemaBuilder.js';
```

---

## Implementation Guide

### 1. Database Adapter

Implement `IDatabaseAdapter` to handle connections and query preparation.

```typescript
import { IDatabaseAdapter, IStatementAdapter, TableColumnInfo } from '@iamkirbki/database-handler-core';
import YourDatabaseLibrary from 'your-database-library';
import MyDatabaseStatement from './MyDatabaseStatement.js';

export default class MyDatabaseAdapter implements IDatabaseAdapter {
    private connection: YourDatabaseLibrary.Connection | null = null;

    // Connection management
    async connect(params: YourDatabaseLibrary.ConnectionConfig): Promise<void> {
        this.connection = await YourDatabaseLibrary.connect(params);
        console.log('Connected to MyDatabase');
    }

    // Query preparation with parameter conversion
    async prepare(query: string): Promise<IStatementAdapter> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        // Convert @paramName syntax to your database's format
        const convertedQuery = this.convertParameters(query);
        const statement = await this.connection.prepare(convertedQuery);
        
        return new MyDatabaseStatement(statement, this.connection);
    }

    // Execute DDL statements
    async exec(query: string): Promise<void> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        await this.connection.execute(query);
    }

    // Transaction support
    async transaction(fn: (items: any[]) => void): Promise<Function> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        await this.connection.beginTransaction();
        
        try {
            const items: any[] = [];
            fn(items);
            
            return async () => {
                await this.connection!.commit();
            };
        } catch (error) {
            await this.connection.rollback();
            throw error;
        }
    }

    // Table metadata retrieval
    async tableColumnInformation(tableName: string): Promise<TableColumnInfo[]> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        // Query your database's information schema or system tables
        const query = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                column_key
            FROM information_schema.columns
            WHERE table_name = ?
            ORDER BY ordinal_position
        `;

        const columns = await this.connection.query(query, [tableName]);

        return columns.map((col: any, index: number) => ({
            cid: index,
            name: col.column_name,
            type: col.data_type,
            notnull: col.is_nullable === 'NO' ? 1 : 0,
            dflt_value: col.column_default,
            pk: col.column_key === 'PRI' ? 1 : 0
        }));
    }

    // Cleanup
    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
            console.log('MyDatabase connection closed');
        }
    }

    // Helper: Convert @paramName to your database's format
    private convertParameters(query: string): string {
        // Example: Convert @paramName to ? (MySQL style)
        return query.replace(/@\w+/g, '?');
        
        // Or convert to $1, $2, $3 (PostgreSQL style)
        // let index = 1;
        // return query.replace(/@\w+/g, () => `$${index++}`);
    }
}
```

**Key Points:**
- Store connection instance
- Convert `@paramName` syntax to your database's parameter format
- Handle connection errors gracefully
- Clean up resources in `close()`

---

### 2. Statement Adapter

Implement `IStatementAdapter` to execute queries with parameters.

```typescript
import { IStatementAdapter, RunResult } from '@iamkirbki/database-handler-core';
import YourDatabaseLibrary from 'your-database-library';

export default class MyDatabaseStatement implements IStatementAdapter {
    private statement: YourDatabaseLibrary.Statement;
    private connection: YourDatabaseLibrary.Connection;

    constructor(statement: YourDatabaseLibrary.Statement, connection: YourDatabaseLibrary.Connection) {
        this.statement = statement;
        this.connection = connection;
    }

    // Execute INSERT, UPDATE, DELETE
    async run(parameters?: Record<string, any>): Promise<RunResult> {
        const [query, params] = this.convertParameters(this.statement.sql, parameters || {});
        const result = await this.connection.execute(query, params);

        return {
            changes: result.affectedRows || 0,
            lastInsertRowid: result.insertId
        };
    }

    // Fetch all matching rows
    async all(parameters?: Record<string, any>): Promise<any[]> {
        const [query, params] = this.convertParameters(this.statement.sql, parameters || {});
        const result = await this.connection.query(query, params);
        return result.rows || result;
    }

    // Fetch first matching row
    async get(parameters?: Record<string, any>): Promise<any> {
        const [query, params] = this.convertParameters(this.statement.sql, parameters || {});
        const result = await this.connection.query(query, params);
        return result.rows?.[0] || result[0];
    }

    // Optional: Synchronous execution for transaction support
    runSync?(parameters?: Record<string, any>): RunResult {
        // Only implement if your database library supports synchronous operations
        const result = this.statement.runSync(parameters || {});
        
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }

    // Helper: Convert parameters to array format
    private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
        const paramList: any[] = [];
        
        // For MySQL-style (?)
        const convertedQuery = query.replace(/@(\w+)/g, (match, paramName) => {
            paramList.push(params[paramName]);
            return '?';
        });

        // For PostgreSQL-style ($1, $2, $3)
        // let index = 1;
        // const convertedQuery = query.replace(/@(\w+)/g, (match, paramName) => {
        //     paramList.push(params[paramName]);
        //     return `$${index++}`;
        // });

        return [convertedQuery, paramList];
    }
}
```

**Key Points:**
- Convert `@paramName` to your database's parameter format
- Map result formats to expected `RunResult` structure
- Implement `runSync()` only if database supports synchronous operations

---

### 3. Schema Builder

Extend `AbstractSchemaBuilder` for DDL operations.

```typescript
import { AbstractSchemaBuilder, SchemaTableBuilder, IDatabaseAdapter } from '@iamkirbki/database-handler-core';

export default class MyDatabaseSchemaBuilder extends AbstractSchemaBuilder {
    private adapter: IDatabaseAdapter;

    constructor(adapter: IDatabaseAdapter) {
        super();
        this.adapter = adapter;
    }

    // Create new table
    async createTable(name: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const columns = builder.getColumns().map(col => {
            let definition = `${col.name} ${this.mapType(col.type, col.length)}`;
            
            if (col.primary) definition += ' PRIMARY KEY';
            if (col.autoIncrement) definition += ' AUTO_INCREMENT';
            if (col.unique) definition += ' UNIQUE';
            if (col.notNull) definition += ' NOT NULL';
            if (col.default !== undefined) {
                definition += ` DEFAULT ${this.formatDefault(col.default)}`;
            }
            
            return definition;
        }).join(', ');

        const sql = `CREATE TABLE ${name} (${columns})`;
        await this.adapter.exec(sql);
    }

    // Drop existing table
    async dropTable(name: string): Promise<void> {
        await this.adapter.exec(`DROP TABLE IF EXISTS ${name}`);
    }

    // Modify existing table
    async alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const operations = builder.getOperations();

        for (const op of operations) {
            if (op.type === 'rename') {
                await this.adapter.exec(`ALTER TABLE ${oldName} RENAME TO ${op.newName}`);
            } else if (op.type === 'addColumn') {
                const type = this.mapType(op.dataType, op.length);
                await this.adapter.exec(`ALTER TABLE ${oldName} ADD COLUMN ${op.name} ${type}`);
            } else if (op.type === 'dropColumn') {
                await this.adapter.exec(`ALTER TABLE ${oldName} DROP COLUMN ${op.name}`);
            }
        }
    }

    // Map generic types to database-specific types
    private mapType(type: string, length?: number): string {
        const typeMap: Record<string, string> = {
            'increments': 'INT AUTO_INCREMENT',
            'string': `VARCHAR(${length || 255})`,
            'text': 'TEXT',
            'integer': 'INT',
            'bigInteger': 'BIGINT',
            'float': 'FLOAT',
            'decimal': 'DECIMAL(10, 2)',
            'boolean': 'TINYINT(1)',
            'date': 'DATE',
            'timestamp': 'TIMESTAMP',
            'json': 'JSON'
        };

        return typeMap[type] || 'VARCHAR(255)';
    }

    // Format default values for SQL
    private formatDefault(value: any): string {
        if (typeof value === 'string') {
            return value === 'CURRENT_TIMESTAMP' ? value : `'${value}'`;
        }
        return String(value);
    }
}
```

**Key Points:**
- Map generic column types to database-specific types
- Handle constraints (PRIMARY KEY, UNIQUE, NOT NULL)
- Support ALTER TABLE operations
- Format default values correctly

---

## Parameter Conversion

### Understanding @paramName Syntax

The core library uses `@paramName` syntax for parameters. Your adapter must convert this to your database's format.

### Conversion Patterns

#### MySQL / MariaDB (?)

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    const paramList: any[] = [];
    
    const converted = query.replace(/@(\w+)/g, (match, paramName) => {
        paramList.push(params[paramName]);
        return '?';
    });
    
    return [converted, paramList];
}

// Input:  SELECT * FROM users WHERE id = @id AND status = @status
// Output: SELECT * FROM users WHERE id = ? AND status = ?
// Params: [1, 'active']
```

#### PostgreSQL ($1, $2, $3)

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    const paramList: any[] = [];
    let index = 1;
    
    const converted = query.replace(/@(\w+)/g, (match, paramName) => {
        paramList.push(params[paramName]);
        return `$${index++}`;
    });
    
    return [converted, paramList];
}

// Input:  SELECT * FROM users WHERE id = @id AND status = @status
// Output: SELECT * FROM users WHERE id = $1 AND status = $2
// Params: [1, 'active']
```

#### SQLite (native @paramName)

```typescript
// No conversion needed - SQLite supports @paramName natively
async run(parameters?: Record<string, any>): Promise<RunResult> {
    const result = this.statement.run(parameters || {});
    return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
    };
}
```

#### Named Parameters (Oracle, SQL Server)

```typescript
private convertParameters(query: string, params: Record<string, any>): [string, any[]] {
    // Oracle uses :paramName
    const converted = query.replace(/@(\w+)/g, ':$1');
    return [converted, params];
}

// Input:  SELECT * FROM users WHERE id = @id
// Output: SELECT * FROM users WHERE id = :id
// Params: { id: 1 }
```

---

## Testing Your Adapter

### Test Structure

```typescript
// tests/adapter.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import MyDatabaseAdapter from '../src/MyDatabaseAdapter';

describe('MyDatabaseAdapter', () => {
    let adapter: MyDatabaseAdapter;

    beforeAll(async () => {
        adapter = new MyDatabaseAdapter();
        await adapter.connect({
            host: 'localhost',
            port: 3306,
            database: 'test',
            user: 'root',
            password: 'password'
        });
    });

    afterAll(async () => {
        await adapter.close();
    });

    it('should connect to database', async () => {
        expect(adapter).toBeDefined();
    });

    it('should execute DDL statements', async () => {
        await adapter.exec(`
            CREATE TABLE IF NOT EXISTS test_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100)
            )
        `);

        const columns = await adapter.tableColumnInformation('test_users');
        expect(columns).toHaveLength(2);
    });

    it('should prepare and execute statements', async () => {
        const stmt = await adapter.prepare('INSERT INTO test_users (name) VALUES (@name)');
        const result = await stmt.run({ name: 'John Doe' });
        
        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should fetch all rows', async () => {
        const stmt = await adapter.prepare('SELECT * FROM test_users');
        const rows = await stmt.all();
        
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
    });

    it('should fetch single row', async () => {
        const stmt = await adapter.prepare('SELECT * FROM test_users WHERE id = @id');
        const row = await stmt.get({ id: 1 });
        
        expect(row).toBeDefined();
        expect(row.name).toBe('John Doe');
    });

    it('should handle transactions', async () => {
        const commit = await adapter.transaction(() => {
            // Transaction operations
        });

        await commit();
    });
});
```

### Integration Testing

```typescript
// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import Container from '@iamkirbki/database-handler-core';
import { MyDatabaseAdapter } from '../src';

describe('Integration with Core', () => {
    it('should register with Container', async () => {
        const adapter = new MyDatabaseAdapter();
        await adapter.connect(config);

        const container = Container.getInstance();
        container.registerAdapter('mydatabase', adapter, true);

        const registered = container.getAdapter('mydatabase');
        expect(registered).toBe(adapter);
    });

    it('should work with Model class', async () => {
        // Test with actual Model usage
        const User = class extends Model {
            static tableName = 'users';
        };

        const user = await User.find(1).first();
        expect(user).toBeDefined();
    });
});
```

---

## Publishing Your Package

### 1. Build Your Package

```bash
npm run build
```

### 2. Test Locally

```bash
# Link your package
npm link

# In another project
npm link @yourorg/database-handler-mydatabase
```

### 3. Publish to npm

```bash
npm login
npm publish --access public
```

### 4. Create Documentation

**README.md:**
```markdown
# MyDatabase Adapter for Kirbkis Database Handler

MyDatabase integration for the Kirbkis Database Handler.

## Installation

\`\`\`bash
npm install @iamkirbki/database-handler-core
npm install @yourorg/database-handler-mydatabase
npm install your-database-library
\`\`\`

## Usage

\`\`\`typescript
import Container from '@iamkirbki/database-handler-core';
import { MyDatabaseAdapter } from '@yourorg/database-handler-mydatabase';

const adapter = new MyDatabaseAdapter();
await adapter.connect({
    host: 'localhost',
    port: 3306,
    database: 'myapp',
    user: 'root',
    password: 'password'
});

const container = Container.getInstance();
container.registerAdapter('default', adapter, true);
\`\`\`

## API

See [Kirbkis Database Handler Documentation](https://github.com/iamkirbki/database-handler).
```

---

## Real-World Examples

Study these official adapters:

### PostgreSQL Adapter
- Package: `@iamkirbki/database-handler-pg`
- Location: `/packages/pg/`
- Async operations with connection pooling
- `$1, $2, $3` parameter style
- Full ALTER TABLE support

### SQLite Adapter
- Package: `@iamkirbki/database-handler-bettersqlite3`
- Location: `/packages/bettersqlite3/`
- Synchronous operations
- Native `@paramName` support
- `runSync()` for transactions

---

## Additional Resources

- [IDatabaseAdapter Documentation](IDatabaseAdapter.md)
- [IStatementAdapter Documentation](IStatementAdapter.md)
- [ISchemaBuilder Documentation](ISchemaBuilder.md)
- [Core Package Documentation](../../../README.md)
- [Main Repository](https://github.com/iamkirbki/database-handler)

---

## Support

Questions? Open an issue on [GitHub](https://github.com/iamkirbki/database-handler/issues).

Happy coding! 🚀
