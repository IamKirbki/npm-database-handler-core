import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Table from '@core/base/Table';
import Container from '@core/runtime/Container';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';

describe('JSON Insertion', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        Container.resetInstance();
        mockAdapter = new MockDatabaseAdapter();
        Container.getInstance().registerAdapter('default', mockAdapter, true);
        mockAdapter.setTableExists('users', true);
    });

    afterEach(() => {
        Container.resetInstance();
    });

    it('should serialize objects to JSON strings before insertion', async () => {
        const table = new Table({ name: 'users' });
        const metadata = { theme: 'dark', notifications: true };

        await table.CreateRecord({
            name: 'Alice',
            metadata: metadata
        });

        // Get the parameters passed to the mock adapter's run method via prepared statements
        const executions = mockAdapter.getStatementExecutions();
        const insertExecution = executions.find(e => e.query.includes('INSERT INTO'))?.executions[0];
        const params = insertExecution?.values;

        expect(typeof params.metadata).toBe('string');
        expect(params.metadata).toBe(JSON.stringify(metadata));
    });

    it('should serialize arrays to JSON strings before insertion', async () => {
        const table = new Table({ name: 'users' });
        const roles = ['admin', 'editor'];

        await table.CreateRecord({
            name: 'Bob',
            roles: roles
        });

        const executions = mockAdapter.getStatementExecutions();
        const insertExecution = executions.find(e => e.query.includes('INSERT INTO') && (e.executions[0].values!).name === 'Bob')?.executions[0];
        const params = insertExecution?.values;

        expect(typeof params.roles).toBe('string');
        expect(params.roles).toBe(JSON.stringify(roles));
    });
});
