import { describe, it, expect } from 'vitest';
import QueryStatementBuilder from '../../helpers/QueryStatementBuilder';

describe('QueryStatementBuilder - Spatial Expressions', () => {
    describe('BuildSelect with spatialDistance expression', () => {
        it('should build SELECT query with spatial distance expression in km', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 }, // New York
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('6371'); // Earth radius in km
            expect(query).toContain('acos');
            expect(query).toContain('cos(radians(40.7128))');
            expect(query).toContain('radians(-74.006'); // Handles both -74.0060 and -74.006
            expect(query).toContain('latitude');
            expect(query).toContain('longitude');
            expect(query).toContain('AS distance');
        });

        it('should throw if invalid reference point is provided', () => {
            expect(() => {
                const query = QueryStatementBuilder.BuildSelect('locations', {
                    expressions: [
                        {
                            type: 'spatialDistance',
                            parameters: {
                                referencePoint: { lat: 'invalid', lon: -74.0060 },
                                targetColumns: { lat: 'latitude', lon: 'longitude' },
                                unit: 'km'
                            }
                        }
                    ]
                });
            }).toThrow('Invalid reference point for spatial distance expression.');
        });

        it('should build SELECT query with spatial distance expression in miles', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 34.0522, lon: -118.2437 }, // Los Angeles
                            targetColumns: { lat: 'lat', lon: 'lon' },
                            unit: 'miles'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('3959'); // Earth radius in miles
            expect(query).toContain('34.0522');
            expect(query).toContain('-118.2437');
        });

        it('should use custom alias for distance calculation', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 51.5074, lon: -0.1278 }, // London
                            targetColumns: { lat: 'lat', lon: 'lon' },
                            unit: 'km',
                            alias: 'distance_from_london'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('AS distance_from_london');
            expect(query).not.toContain('AS distance ');
        });

        it('should add HAVING clause for maxDistance filter', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km',
                            maxDistance: 50
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('HAVING distance <= 50');
        });

        it('should add HAVING clause with custom alias', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km',
                            alias: 'dist',
                            maxDistance: 100
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('HAVING dist <= 100');
        });

        it('should add ORDER BY for distance sorting ASC', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km',
                            orderByDistance: 'ASC'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('ORDER BY distance ASC');
        });

        it('should add ORDER BY for distance sorting DESC', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km',
                            orderByDistance: 'DESC'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('ORDER BY distance DESC');
        });

        it('should use custom earth radius when provided', () => {
            const customRadius = 6500;
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            earthRadius: customRadius,
                            unit: 'km'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('6500');
            expect(query).not.toContain('6371');
        });

        it('should combine spatial expression with regular columns', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                select: 'id, name, address',
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'latitude', lon: 'longitude' },
                            unit: 'km',
                            alias: 'distance_km'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('SELECT id, name, address,');
            expect(query).toContain('AS distance_km');
        });

        it('should combine spatial expression with WHERE clause', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                where: { active: true, category: 'restaurant' },
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'lat', lon: 'lon' },
                            unit: 'km'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('WHERE');
            expect(query).toContain('active = @active');
            expect(query).toContain('category = @category');
            expect(query).toContain('AS distance');
        });

        it('should combine spatial expression with LIMIT', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                limit: 10,
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'lat', lon: 'lon' },
                            unit: 'km',
                            orderByDistance: 'ASC'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('LIMIT 10');
            expect(query).toContain('ORDER BY distance ASC');
        });

        it('should build complete query with all spatial features', () => {
            const query = QueryStatementBuilder.BuildSelect('stores', {
                select: 'id, name, category',
                where: { active: true },
                limit: 20,
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: 40.7128, lon: -74.0060 },
                            targetColumns: { lat: 'store_lat', lon: 'store_lon' },
                            unit: 'km',
                            alias: 'distance_from_me',
                            maxDistance: 10,
                            orderByDistance: 'ASC'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('SELECT id, name, category,');
            expect(query).toContain('FROM "stores"');
            expect(query).toContain('WHERE active = @active');
            expect(query).toContain('6371'); // km
            expect(query).toContain('store_lat');
            expect(query).toContain('store_lon');
            expect(query).toContain('AS distance_from_me');
            expect(query).toContain('HAVING distance_from_me <= 10');
            expect(query).toContain('ORDER BY distance_from_me ASC');
            expect(query).toContain('LIMIT 20');
        });

        it('should handle negative coordinates correctly', () => {
            const query = QueryStatementBuilder.BuildSelect('locations', {
                expressions: [
                    {
                        type: 'spatialDistance',
                        parameters: {
                            referencePoint: { lat: -33.8688, lon: 151.2093 }, // Sydney (negative lat)
                            targetColumns: { lat: 'lat', lon: 'lon' },
                            unit: 'km'
                        }
                    }
                ]
            });
            
            console.log(query);
            expect(query).toContain('-33.8688');
            expect(query).toContain('151.2093');
        });
    });
});
