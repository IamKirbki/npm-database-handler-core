import { DefaultQueryParameters, ExtraQueryParameters, PossibleExpressions, SpacialDistanceDefinition } from "@core/types/query";

type expressionClause = {
    baseExpressionClause: string;
    havingClause?: string;
    orderByClause?: string;
};

export default class QueryExpressionBuilder {
    public static buildExpressionsPart(expressions: PossibleExpressions[]): expressionClause[] {
        const queryParts: expressionClause[] = [];

        expressions.forEach(expression => {
            if (expression.type === 'spatialDistance') {
                queryParts.push(this.BuildSpacialDistanceExpression(expression.parameters));
            }
        });

        return queryParts;
    }

    public static BuildSpacialDistanceExpression(expression: SpacialDistanceDefinition): expressionClause {
        if(typeof expression.referencePoint.lat !== 'number' || typeof expression.referencePoint.lon !== 'number') {
            throw new Error('Invalid reference point for spatial distance expression.');
        }
        const baseExpressionClause = `(
                ${expression.earthRadius || (expression.unit === 'km' ? 6371 : 3959)} * acos(
                    cos(radians(${expression.referencePoint.lat}))
                    * cos(radians(${expression.targetColumns.lat}))
                    * cos(radians(${expression.targetColumns.lon}) - radians(${expression.referencePoint.lon}))
                    * sin(radians(${expression.referencePoint.lat}))
                    * sin(radians(${expression.targetColumns.lat}))
                )
            ) AS ${expression.alias || 'distance'}`;

        const havingClause = expression.maxDistance ? `HAVING ${expression.alias || 'distance'} <= ${expression.maxDistance}` : undefined;
        const orderByClause = expression.orderByDistance ? `${expression.alias || 'distance'} ${expression.orderByDistance}` : undefined;

        return { baseExpressionClause, havingClause, orderByClause };
    }

    public static SyncQueryOptionsWithExpressions(expressions: expressionClause[], options: DefaultQueryParameters & ExtraQueryParameters): { options: DefaultQueryParameters & ExtraQueryParameters, havingClauses: string[] } {
        const havingClauses: string[] = [];

        expressions.map(expr => {
            Object.entries(expr).forEach(([key, clause]) => {
                if (clause) {
                    if (key === 'baseExpressionClause') {
                        if (options.select) {
                            options.select += `, ${clause}`;
                        } else {
                            options.select = `*, ${clause}`;
                        }
                    } else if (key === 'havingClause') {
                        havingClauses.push(clause);
                    } else if (key === 'orderByClause') {
                        options.orderBy = clause;
                    }
                }
            });
        })

        return { options, havingClauses };
    }
}