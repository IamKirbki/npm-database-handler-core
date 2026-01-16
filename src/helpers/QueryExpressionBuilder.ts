import { DefaultQueryParameters, ExtraQueryParameters, PossibleExpressions, SpatialQueryExpression } from "@core/types/query";

export type expressionClause = {
    baseExpressionClause?: string;
    phase?: 'base' | 'projection';
    requiresWrapping?: boolean;
    whereClause?: string;
    orderByClause?: string;
};

// Type for expression builder functions
// eslint-disable-next-line no-unused-vars
type ExpressionBuilderFunction<T extends PossibleExpressions = PossibleExpressions> = (expression: T) => expressionClause;

export default class QueryExpressionBuilder {
    // Registry of expression builders - easily extensible
    private static expressionBuilders: Map<string, ExpressionBuilderFunction> = new Map([
        ['spatialDistance', (expr) => QueryExpressionBuilder.BuildSpacialDistanceExpression(expr as SpatialQueryExpression)],
        // Add new expression builders here:
        // ['jsonAggregation', (expr) => QueryExpressionBuilder.BuildJsonAggregation(expr as JsonAggregationExpression)],
        // ['windowFunction', (expr) => QueryExpressionBuilder.BuildWindowFunction(expr as WindowFunctionExpression)],
    ]);

    /**
     * Register a custom expression builder
     * Allows adding new expression types without modifying core code
     */
    public static registerExpressionBuilder<T extends PossibleExpressions>(
        type: string,
        builder: ExpressionBuilderFunction<T>
    ): void {
        this.expressionBuilders.set(type, builder as ExpressionBuilderFunction);
    }

    public static buildExpressionsPart(expressions: PossibleExpressions[]): expressionClause[] {
        const queryParts: expressionClause[] = [];

        expressions.forEach(expression => {
            const builder = this.expressionBuilders.get(expression.type);
            if (builder) {
                queryParts.push(builder(expression));
            } else {
                // eslint-disable-next-line no-undef
                console.warn(`No builder registered for expression type: ${expression.type}`);
            }
        });

        return queryParts;
    }

    public static filterExpressionsByPhase(expressions: expressionClause[], phase: 'base' | 'projection'): expressionClause[] {
        return expressions.filter(expr => expr.phase === phase);
    }

    public static buildSelectClause(selectOption: string | undefined, expressions: expressionClause[]): string {
        const flatExpressions = this.filterExpressionsByPhase(expressions, 'base');
        const selectColumns: string[] = [];
        
        if (selectOption && selectOption !== '*') {
            selectColumns.push(selectOption);
        }
        if (flatExpressions.length > 0) {
            selectColumns.push(flatExpressions.map(expr => expr.baseExpressionClause).join(", "));
        }
        
        return selectColumns.length > 0 ? selectColumns.join(", ") : '*';
    }

    public static buildFromClause(tableName: string, expressions: expressionClause[]): string {
        const projectionExpressions = this.filterExpressionsByPhase(expressions, 'projection');
        
        if (projectionExpressions.length > 0) {
            const projectionClauses = projectionExpressions.map(expr => expr.baseExpressionClause).join(", ");
            return `FROM (SELECT *, ${projectionClauses} FROM "${tableName}") AS subquery`;
        }
        
        return `FROM "${tableName}"`;
    }

    public static buildOrderByFromExpressions(expressions: expressionClause[]): string {
        const orderByClauses = expressions
            .filter(expr => expr.orderByClause)
            .map(expr => expr.orderByClause);
        
        return orderByClauses.length > 0 ? `ORDER BY ${orderByClauses.join(", ")}` : '';
    }

    public static buildWhereWithLiterals(baseWhere: string, literalWhere?: string[]): string {
        const whereParts: string[] = [];
        
        if (baseWhere) {
            whereParts.push(baseWhere);
        }
        
        if (literalWhere && literalWhere.length > 0) {
            if (whereParts.length > 0) {
                whereParts.push(`AND ${literalWhere.join(' AND ')}`);
            } else {
                whereParts.push(`WHERE ${literalWhere.join(' AND ')}`);
            }
        }
        
        return whereParts.join(" ");
    }

    public static buildJoinOuterSelectClause(columnAliases: string[], expressions: expressionClause[]): string {
        const projectionExpressions = this.filterExpressionsByPhase(expressions, 'projection');
        const expressionAliases = projectionExpressions
            .map(expr => {
                // Extract alias from "... AS alias" pattern
                const match = expr.baseExpressionClause?.match(/AS (\w+)$/i);
                return match ? match[1] : null;
            })
            .filter(alias => alias !== null) as string[];
        
        return [...columnAliases, ...expressionAliases].join(',\n    ');
    }

    public static shouldWrapJoinQuery(expressions: expressionClause[]): boolean {
        const projectionExpressions = this.filterExpressionsByPhase(expressions, 'projection');
        return projectionExpressions.length > 0 && projectionExpressions.some(expr => 
            expr.whereClause || expr.orderByClause
        );
    }

    public static BuildSpacialDistanceExpression(expression: SpatialQueryExpression): expressionClause {
        if (typeof expression.parameters.referencePoint.lat !== 'number' || typeof expression.parameters.referencePoint.lon !== 'number') {
            throw new Error('Invalid reference point for spatial distance expression.');
        }

        const baseExpressionClause: string = `${expression.parameters.earthRadius ? expression.parameters.earthRadius : (expression.parameters.unit === 'km' ? 6371 : 3959)} * acos(
            cos(radians(${expression.parameters.referencePoint.lat}))
            * cos(radians(${expression.parameters.targetColumns.lat}))
            * cos(radians(${expression.parameters.targetColumns.lon}) - radians(${expression.parameters.referencePoint.lon}))
            + sin(radians(${expression.parameters.referencePoint.lat}))
            * sin(radians(${expression.parameters.targetColumns.lat}))
        ) AS ${expression.parameters.alias}`;

        const whereClause = expression.parameters.maxDistance
            ? `${expression.parameters.alias} <= ${expression.parameters.maxDistance}`
            : undefined;

        const orderByClause = expression.parameters.orderByDistance
            ? `${expression.parameters.alias} ${expression.parameters.orderByDistance}`
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping: expression.requirements.requiresSelectWrapping || false,
            whereClause,
            orderByClause
        };
    }

    public static SyncQueryOptionsWithExpressions(expressions: expressionClause[], options: DefaultQueryParameters & ExtraQueryParameters): DefaultQueryParameters & ExtraQueryParameters & { literalWhere?: string[] } {
        const syncedOptions: DefaultQueryParameters & ExtraQueryParameters & { literalWhere?: string[] } = { ...options };

        expressions.forEach(expression => {
            if (expression.whereClause) {
                if (!syncedOptions.literalWhere) {
                    syncedOptions.literalWhere = [];
                }
                // Don't add WHERE prefix - it will be handled by buildWhereWithLiterals
                syncedOptions.literalWhere.push(expression.whereClause);
            }
        });

        return syncedOptions;
    }
}