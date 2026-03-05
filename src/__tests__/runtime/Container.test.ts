import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Container from '@core/runtime/Container';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';
import AdapterNotFoundError from '@core/helpers/Errors/AdapterErrors/AdapterNotFoundError';
import NoDefaultAdapterError from '@core/helpers/Errors/AdapterErrors/NoDefaultAdapterError';

describe('Container', () => {
    let mockAdapter: MockDatabaseAdapter;

    beforeEach(() => {
        Container.resetInstance();
        mockAdapter = new MockDatabaseAdapter();
    });

    afterEach(() => {
        Container.resetInstance();
    });

    describe('getInstance', () => {
        it('should return a Container instance', () => {
            const container = Container.getInstance();
            expect(container).toBeDefined();
        });

        it('should return same instance (singleton)', () => {
            const container1 = Container.getInstance();
            const container2 = Container.getInstance();
            expect(container1).toBe(container2);
        });
    });

    describe('registerAdapter', () => {
        it('should register an adapter', () => {
            const container = Container.getInstance();
            container.registerAdapter('default', mockAdapter);
            
            const adapter = container.getAdapter('default');
            expect(adapter).toBe(mockAdapter);
        });

        it('should set first adapter as default automatically', () => {
            const container = Container.getInstance();
            container.registerAdapter('default', mockAdapter);
            
            const adapter = container.getAdapter();
            expect(adapter).toBe(mockAdapter);
        });

        it('should set adapter as default when flag is true', () => {
            const container = Container.getInstance();
            container.registerAdapter('first', new MockDatabaseAdapter());
            container.registerAdapter('default', mockAdapter, true);
            
            const adapter = container.getAdapter();
            expect(adapter).toBe(mockAdapter);
        });

        it('should allow registering multiple adapters', () => {
            const adapter1 = new MockDatabaseAdapter();
            const adapter2 = new MockDatabaseAdapter();
            
            const container = Container.getInstance();
            container.registerAdapter('primary', adapter1);
            container.registerAdapter('secondary', adapter2);
            
            expect(container.getAdapter('primary')).toBe(adapter1);
            expect(container.getAdapter('secondary')).toBe(adapter2);
        });
    });

    describe('getAdapter', () => {
        it('should return registered adapter by name', () => {
            const container = Container.getInstance();
            container.registerAdapter('test', mockAdapter);
            
            const adapter = container.getAdapter('test');
            expect(adapter).toBe(mockAdapter);
        });

        it('should return default adapter when no name provided', () => {
            const container = Container.getInstance();
            container.registerAdapter('default', mockAdapter);
            
            const adapter = container.getAdapter();
            expect(adapter).toBe(mockAdapter);
        });

        it('should throw AdapterNotFoundError for unknown adapter', () => {
            const container = Container.getInstance();
            
            expect(() => container.getAdapter('nonexistent')).toThrow(AdapterNotFoundError);
        });

        it('should throw NoDefaultAdapterError when no default set', () => {
            const container = Container.getInstance();
            
            expect(() => container.getAdapter()).toThrow(NoDefaultAdapterError);
        });
    });

    describe('resetInstance', () => {
        it('should allow creating new instance after reset', () => {
            const container1 = Container.getInstance();
            Container.resetInstance();
            const container2 = Container.getInstance();
            
            expect(container1).not.toBe(container2);
        });
    });

    describe('clear', () => {
        it('should clear all adapters', () => {
            const container = Container.getInstance();
            container.registerAdapter('test', mockAdapter);
            container.clear();
            
            expect(() => container.getAdapter('test')).toThrow(AdapterNotFoundError);
        });

        it('should clear default adapter', () => {
            const container = Container.getInstance();
            container.registerAdapter('default', mockAdapter);
            container.clear();
            
            expect(() => container.getAdapter()).toThrow(NoDefaultAdapterError);
        });
    });

    describe('logging', () => {
        it('should be false by default', () => {
            const container = Container.getInstance();
            expect(container.logging).toBe(false);
        });

        it('should allow setting logging', () => {
            const container = Container.getInstance();
            container.logging = true;
            expect(container.logging).toBe(true);
        });
    });
});
