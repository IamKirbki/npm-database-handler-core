import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container } from '@core/runtime/Container';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';

describe('Repository', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        Container.resetInstance();
        mockAdapter = new MockDatabaseAdapter();
        Container.getInstance().registerAdapter('default', mockAdapter, true);
    });

    afterEach(() => {
        Container.resetInstance();
    });

    describe('Container setup', () => {
        it('should register adapter', () => {
            expect(Container.getInstance().getAdapter('default')).toBe(mockAdapter);
        });
    });
});
