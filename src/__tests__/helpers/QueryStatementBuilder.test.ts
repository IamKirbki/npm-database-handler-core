import { describe, it, expect } from 'vitest';
import QueryStatementBuilder from '../../helpers/QueryBuilders/QueryStatementBuilder';

describe('QueryStatementBuilder - Spatial Expressions', () => {
    it("should build a query", async () => {
        const queryLayers = {
            base: {
                from: 'locations',
                joins: [
                    {
                        fromTable: 'countries',
                        baseTable: 'locations',
                        joinType: 'INNER',
                        on: [
                            { 'countries.id': 'locations.country_id' }
                        ]
                    }
                ],
                where: {
                    distance: "something"
                }
            },
            pretty: {
                groupBy: 'locations.region'
            },
            final: {
                orderBy: "locations.name ASC",
                limit: 10,
                offset: 0
            }
        }
        const builder = new QueryStatementBuilder(queryLayers);
        const sql = await builder.build();

        console.log(sql);

        expect(true).toBe(true);
    })
});
