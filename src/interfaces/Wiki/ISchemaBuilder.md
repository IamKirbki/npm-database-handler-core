# ISchemaBuilder (AbstractSchemaBuilder)

Interface for creating and modifying database table schemas.

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

Create a new table with columns and constraints.

**Parameters:**
- `name` (string) - Table name
- `callback` ((builder: SchemaTableBuilder) => void) - Function to define structure

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

Delete a table.

**Parameters:**
- `name` (string) - Table name

**Returns:** `Promise<void>`

**Example:**
```typescript
await schemaBuilder.dropTable('old_table');
```

---

### `alterTable(oldName, callback)`

Modify existing table structure.

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

## Type Mapping

Map generic column types to database-specific types:

| Generic | PostgreSQL | MySQL | SQLite |
|---------|------------|-------|--------|
| `increments` | `SERIAL` | `INT AUTO_INCREMENT` | `INTEGER AUTOINCREMENT` |
| `string` | `VARCHAR(n)` | `VARCHAR(n)` | `TEXT` |
| `text` | `TEXT` | `TEXT` | `TEXT` |
| `integer` | `INTEGER` | `INT` | `INTEGER` |
| `bigInteger` | `BIGINT` | `BIGINT` | `INTEGER` |
| `float` | `REAL` | `FLOAT` | `REAL` |
| `boolean` | `BOOLEAN` | `TINYINT(1)` | `INTEGER` |
| `timestamp` | `TIMESTAMP` | `TIMESTAMP` | `TEXT` |
| `json` | `JSONB` | `JSON` | `TEXT` |

---

## Implementation

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
            if (col.default) def += ` DEFAULT ${col.default}`;
            return def;
        }).join(', ');

        await this.adapter.exec(`CREATE TABLE ${name} (${columns})`);
    }

    async dropTable(name: string): Promise<void> {
        await this.adapter.exec(`DROP TABLE IF EXISTS ${name}`);
    }

    async alterTable(oldName: string, callback: (builder: SchemaTableBuilder) => void): Promise<void> {
        const builder = new SchemaTableBuilder();
        callback(builder);

        for (const op of builder.getOperations()) {
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

    private mapType(type: string, length?: number): string {
        const typeMap: Record<string, string> = {
            'increments': 'INT AUTO_INCREMENT',
            'string': `VARCHAR(${length || 255})`,
            'text': 'TEXT',
            'integer': 'INT',
            'boolean': 'TINYINT(1)',
            'timestamp': 'TIMESTAMP',
            'json': 'JSON'
        };
        return typeMap[type] || 'VARCHAR(255)';
    }
}
```

---

## Database Considerations

**PostgreSQL:**
- Use `SERIAL` for auto-increment
- `JSONB` for JSON (better performance)
- Full ALTER TABLE support

**MySQL:**
- Use `AUTO_INCREMENT` keyword
- Full ALTER TABLE support

**SQLite:**
- Limited ALTER TABLE (no DROP COLUMN)
- Use table recreation for complex changes

---

## See Also

- [Custom Adapter Guide](CustomAdapterGuide.md) - Full implementation guide
- [IDatabaseAdapter](IDatabaseAdapter.md) - Database adapter interface
- [SchemaTableBuilder](../../abstract/Wiki/SchemaTableBuilder.md) - Column definition API
