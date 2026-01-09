# ISchemaBuilder (AbstractSchemaBuilder)

Interface for creating and modifying database table schemas programmatically.

## Overview

`AbstractSchemaBuilder` provides a fluent API for schema operations. Extend this class to implement database-specific DDL generation for CREATE TABLE, DROP TABLE, and ALTER TABLE operations.

## Interface Definition

```typescript
abstract class AbstractSchemaBuilder {
    abstract createTable(name: string, callback: (builder: SchemaTableBuilder) => void): Promise<void>;
    abstract dropTable(name: string): Promise<void>;
    abstract alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void>;
}
```

---

## Methods

### `createTable(name, callback)`

Create a new table with specified columns and constraints.

**Parameters:**
- `name` (string) - Table name
- `callback` ((builder: SchemaTableBuilder) => void) - Function to define table structure

**Returns:** `Promise<void>`

**Example:**
```typescript
await schemaBuilder.createTable('users', (table) => {
    table.increments('id');
    table.string('email', 255).unique();
    table.string('name', 100);
    table.timestamp('created_at').default('CURRENT_TIMESTAMP');
});
```

---

### `dropTable(name)`

Delete a table from the database.

**Parameters:**
- `name` (string) - Table name to drop

**Returns:** `Promise<void>`

**Example:**
```typescript
await schemaBuilder.dropTable('old_table');
```

---

### `alterTable(oldName, callback)`

Modify an existing table structure.

**Parameters:**
- `oldName` (string) - Current table name
- `callback` ((builder: SchemaTableBuilder) => void) - Function to define modifications

**Returns:** `Promise<void>`

**Example:**
```typescript
await schemaBuilder.alterTable('users', (table) => {
    table.rename('customers');
    table.addColumn('phone', 'string', 20);
    table.dropColumn('old_field');
});
```

---

## Creating a Schema Builder

Extend `AbstractSchemaBuilder` and implement DDL generation:

```typescript
import { AbstractSchemaBuilder, SchemaTableBuilder, IDatabaseAdapter } from '@iamkirbki/database-handler-core';

export default class MySchemaBuilder extends AbstractSchemaBuilder {
    private adapter: IDatabaseAdapter;

    constructor(adapter: IDatabaseAdapter) {
        super();
        this.adapter = adapter;
    }

    async createTable(name: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const columns = builder.getColumns().map(col => {
            let def = `${col.name} ${this.mapType(col.type, col.length)}`;
            
            if (col.primary) def += ' PRIMARY KEY';
            if (col.autoIncrement) def += ' AUTO_INCREMENT';
            if (col.unique) def += ' UNIQUE';
            if (col.notNull) def += ' NOT NULL';
            if (col.default !== undefined) def += ` DEFAULT ${col.default}`;
            
            return def;
        }).join(', ');

        const sql = `CREATE TABLE ${name} (${columns})`;
        await this.adapter.exec(sql);
    }

    async dropTable(name: string): Promise<void> {
        await this.adapter.exec(`DROP TABLE IF EXISTS ${name}`);
    }

    async alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const operations = builder.getOperations();
        
        for (const op of operations) {
            let sql = '';
            
            if (op.type === 'rename') {
                sql = `ALTER TABLE ${oldName} RENAME TO ${op.newName}`;
            } else if (op.type === 'addColumn') {
                sql = `ALTER TABLE ${oldName} ADD COLUMN ${op.name} ${this.mapType(op.dataType, op.length)}`;
            } else if (op.type === 'dropColumn') {
                sql = `ALTER TABLE ${oldName} DROP COLUMN ${op.name}`;
            }
            
            await this.adapter.exec(sql);
        }
    }

    private mapType(type: string, length?: number): string {
        // Map generic types to database-specific types
        const typeMap: Record<string, string> = {
            'increments': 'INT AUTO_INCREMENT',
            'string': `VARCHAR(${length || 255})`,
            'text': 'TEXT',
            'integer': 'INT',
            'bigInteger': 'BIGINT',
            'float': 'FLOAT',
            'decimal': 'DECIMAL',
            'boolean': 'BOOLEAN',
            'date': 'DATE',
            'timestamp': 'TIMESTAMP',
            'json': 'JSON'
        };

        return typeMap[type] || 'VARCHAR(255)';
    }
}
```

---

## Real-World Examples

### PostgreSQL Schema Builder

```typescript
export default class PostgresSchemaBuilder extends AbstractSchemaBuilder {
    private adapter: IDatabaseAdapter;

    constructor(adapter: IDatabaseAdapter) {
        super();
        this.adapter = adapter;
    }

    async createTable(name: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const columns = builder.getColumns().map(col => {
            let definition = `${col.name} `;

            // PostgreSQL-specific type mapping
            if (col.autoIncrement) {
                definition += 'SERIAL';
            } else {
                definition += this.getPostgresType(col.type, col.length);
            }

            if (col.primary) definition += ' PRIMARY KEY';
            if (col.unique) definition += ' UNIQUE';
            if (col.notNull) definition += ' NOT NULL';
            if (col.default !== undefined) definition += ` DEFAULT ${col.default}`;

            return definition;
        }).join(', ');

        await this.adapter.exec(`CREATE TABLE ${name} (${columns})`);
    }

    async dropTable(name: string): Promise<void> {
        await this.adapter.exec(`DROP TABLE IF EXISTS ${name}`);
    }

    async alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const operations = builder.getOperations();

        for (const operation of operations) {
            if (operation.type === 'rename') {
                await this.adapter.exec(`ALTER TABLE ${oldName} RENAME TO ${operation.newName}`);
            } else if (operation.type === 'addColumn') {
                const type = this.getPostgresType(operation.dataType, operation.length);
                await this.adapter.exec(`ALTER TABLE ${oldName} ADD COLUMN ${operation.name} ${type}`);
            } else if (operation.type === 'dropColumn') {
                await this.adapter.exec(`ALTER TABLE ${oldName} DROP COLUMN ${operation.name}`);
            }
        }
    }

    private getPostgresType(type: string, length?: number): string {
        const typeMap: Record<string, string> = {
            'increments': 'SERIAL',
            'string': `VARCHAR(${length || 255})`,
            'text': 'TEXT',
            'integer': 'INTEGER',
            'bigInteger': 'BIGINT',
            'float': 'REAL',
            'decimal': 'DECIMAL',
            'boolean': 'BOOLEAN',
            'date': 'DATE',
            'timestamp': 'TIMESTAMP',
            'json': 'JSONB'
        };

        return typeMap[type] || 'VARCHAR(255)';
    }
}
```

### SQLite Schema Builder

```typescript
export default class BetterSqlite3SchemaBuilder extends AbstractSchemaBuilder {
    private adapter: IDatabaseAdapter;

    constructor(adapter: IDatabaseAdapter) {
        super();
        this.adapter = adapter;
    }

    async createTable(name: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const columns = builder.getColumns().map(col => {
            let definition = `${col.name} `;

            // SQLite type mapping
            definition += this.getSQLiteType(col.type, col.length);

            if (col.primary) definition += ' PRIMARY KEY';
            if (col.autoIncrement) definition += ' AUTOINCREMENT';
            if (col.unique) definition += ' UNIQUE';
            if (col.notNull) definition += ' NOT NULL';
            if (col.default !== undefined) definition += ` DEFAULT ${col.default}`;

            return definition;
        }).join(', ');

        await this.adapter.exec(`CREATE TABLE ${name} (${columns})`);
    }

    async dropTable(name: string): Promise<void> {
        await this.adapter.exec(`DROP TABLE IF EXISTS ${name}`);
    }

    async alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        const operations = builder.getOperations();

        for (const operation of operations) {
            if (operation.type === 'rename') {
                await this.adapter.exec(`ALTER TABLE ${oldName} RENAME TO ${operation.newName}`);
            } else if (operation.type === 'addColumn') {
                // SQLite has limited ALTER TABLE support
                const type = this.getSQLiteType(operation.dataType, operation.length);
                await this.adapter.exec(`ALTER TABLE ${oldName} ADD COLUMN ${operation.name} ${type}`);
            } else if (operation.type === 'dropColumn') {
                // SQLite doesn't support DROP COLUMN directly
                // Requires table recreation strategy
                throw new Error('SQLite does not support DROP COLUMN. Use table recreation strategy.');
            }
        }
    }

    private getSQLiteType(type: string, length?: number): string {
        const typeMap: Record<string, string> = {
            'increments': 'INTEGER',
            'string': 'TEXT',
            'text': 'TEXT',
            'integer': 'INTEGER',
            'bigInteger': 'INTEGER',
            'float': 'REAL',
            'decimal': 'REAL',
            'boolean': 'INTEGER',
            'date': 'TEXT',
            'timestamp': 'TEXT',
            'json': 'TEXT'
        };

        return typeMap[type] || 'TEXT';
    }
}
```

---

## Type Mapping Guide

Map generic column types to database-specific types:

| Generic Type | PostgreSQL | MySQL | SQLite |
|-------------|------------|-------|--------|
| `increments` | `SERIAL` | `INT AUTO_INCREMENT` | `INTEGER AUTOINCREMENT` |
| `string` | `VARCHAR(n)` | `VARCHAR(n)` | `TEXT` |
| `text` | `TEXT` | `TEXT` | `TEXT` |
| `integer` | `INTEGER` | `INT` | `INTEGER` |
| `bigInteger` | `BIGINT` | `BIGINT` | `INTEGER` |
| `float` | `REAL` | `FLOAT` | `REAL` |
| `decimal` | `DECIMAL` | `DECIMAL` | `REAL` |
| `boolean` | `BOOLEAN` | `TINYINT(1)` | `INTEGER` |
| `date` | `DATE` | `DATE` | `TEXT` |
| `timestamp` | `TIMESTAMP` | `TIMESTAMP` | `TEXT` |
| `json` | `JSONB` | `JSON` | `TEXT` |

---

## SchemaTableBuilder Integration

Your schema builder works with `SchemaTableBuilder` which provides column definition methods:

```typescript
const builder = new SchemaTableBuilder();

// Column definitions
builder.increments('id');
builder.string('name', 100);
builder.integer('age');
builder.timestamp('created_at');

// Retrieve column definitions
const columns = builder.getColumns();
// [
//   { name: 'id', type: 'increments', primary: true, autoIncrement: true },
//   { name: 'name', type: 'string', length: 100 },
//   { name: 'age', type: 'integer' },
//   { name: 'created_at', type: 'timestamp' }
// ]

// Retrieve operations (for alterTable)
const operations = builder.getOperations();
// [
//   { type: 'rename', newName: 'customers' },
//   { type: 'addColumn', name: 'email', dataType: 'string', length: 255 },
//   { type: 'dropColumn', name: 'old_field' }
// ]
```

See [SchemaTableBuilder](../../abstract/Wiki/SchemaTableBuilder.md) for full API.

---

## Package Integration

Add schema builder to your adapter package:

**index.ts:**
```typescript
export { default as MyDatabaseAdapter } from './MyDatabaseAdapter';
export { default as MyDatabaseStatement } from './MyDatabaseStatement';
export { default as MySchemaBuilder } from './MySchemaBuilder';
```

**Usage:**
```typescript
import { MyDatabaseAdapter, MySchemaBuilder } from '@yourorg/database-handler-mydatabase';

const adapter = new MyDatabaseAdapter();
await adapter.connect(config);

const schema = new MySchemaBuilder(adapter);

await schema.createTable('products', (table) => {
    table.increments('id');
    table.string('name');
    table.decimal('price');
    table.integer('stock');
    table.timestamp('created_at').default('CURRENT_TIMESTAMP');
});
```

---

## Database-Specific Considerations

### PostgreSQL
- Supports `SERIAL` for auto-increment
- Use `JSONB` for JSON columns (better performance)
- Full ALTER TABLE support

### MySQL
- Use `AUTO_INCREMENT` keyword
- `TINYINT(1)` for boolean
- Full ALTER TABLE support

### SQLite
- Limited ALTER TABLE (no DROP COLUMN)
- All numeric types stored as INTEGER or REAL
- Use table recreation for complex alterations

### MongoDB (NoSQL)
```typescript
// Schema builders may not apply to NoSQL databases
// Instead, implement collection creation and indexing
async createCollection(name: string, schema: any): Promise<void> {
    await this.db.createCollection(name, { validator: schema });
}
```

---

## Testing Your Schema Builder

```typescript
import { describe, it, expect } from 'vitest';

describe('MySchemaBuilder', () => {
    it('should create table with columns', async () => {
        await schema.createTable('test_table', (table) => {
            table.increments('id');
            table.string('name');
        });

        const tableExists = await checkTableExists('test_table');
        expect(tableExists).toBe(true);
    });

    it('should drop table', async () => {
        await schema.dropTable('test_table');

        const tableExists = await checkTableExists('test_table');
        expect(tableExists).toBe(false);
    });

    it('should alter table structure', async () => {
        await schema.alterTable('users', (table) => {
            table.addColumn('email', 'string', 255);
        });

        const columns = await adapter.tableColumnInformation('users');
        expect(columns.find(c => c.name === 'email')).toBeDefined();
    });
});
```

---

## See Also

- [IDatabaseAdapter](IDatabaseAdapter.md) - Database adapter interface
- [SchemaTableBuilder](../../abstract/Wiki/SchemaTableBuilder.md) - Column definition API
- [PostgreSQL Schema Builder](../../../pg/src/PostgresSchemaBuilder.ts) - Reference implementation
- [SQLite Schema Builder](../../../bettersqlite3/src/BetterSqlite3SchemaBuilder.ts) - Reference implementation
