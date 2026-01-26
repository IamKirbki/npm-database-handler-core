import {
    PossibleExpressions,
    SpatialQueryExpression,
    ExpressionBuilderFunction,
    expressionClause,
    TextRelevanceQueryExpression,
    JsonAggregateQueryExpression,
    QueryEvaluationPhase,
} from "@core/types/index.js";
import SpatialDistanceExpression from "./ExpressionBuilders/SpatialDistanceExpression.js";
import { UnknownExpressionTypeError } from "../Errors/ExpressionErrors/UnknownExpressionTypeError.js";
import UnsupportedQueryPhaseError from "../Errors/ExpressionErrors/UnsupportedQueryPhaseError.js";
import TextRelevanceExpression from "./ExpressionBuilders/TextRelevanceExpression.js";
import JsonAggregateExpression from "./ExpressionBuilders/JsonAggregateExpression.js";

/**
 * A normalized, intermediate representation of a query expression.
 *
 * Expressions are NOT SQL strings directly — they are metadata-rich
 * building blocks that later stages of the query builder can reason about.
 *
 * This is what allows:
 * - base vs projection expressions
 * - conditional query wrapping
 * - expression-driven WHERE / ORDER BY injection
 */

/**
 * Central factory and orchestration layer for query expressions.
 *
 * This class is intentionally:
 * - static
 * - registry-driven
 * - dumb about SQL execution
 *
 * Its ONLY job is to translate abstract expressions
 * into structured SQL fragments with metadata.
 */
export default class QueryExpressionBuilder {

    /**
     * Registry mapping expression "type" → builder function.
     *
     * This allows:
     * - zero switch statements
     * - easy plugin-style extension
     * - no touching core logic to add new expressions
     */
    private static expressionBuilders: Map<string, ExpressionBuilderFunction> = new Map([
        [
            'spatialDistance',
            (expr) =>
                new SpatialDistanceExpression().build(
                    expr as SpatialQueryExpression
                )
        ],
        [
            'textRelevance',
            (expr) =>
                new TextRelevanceExpression().build(
                    expr as TextRelevanceQueryExpression
                )
        ],
        [
            'jsonAggregate',
            (expr) =>
                new JsonAggregateExpression().build(
                    expr as JsonAggregateQueryExpression
                )
        ]

        // Future examples:
        // ['jsonAggregation', (expr) => QueryExpressionBuilder.BuildJsonAggregation(expr)]
        // ['windowFunction', (expr) => QueryExpressionBuilder.BuildWindowFunction(expr)]
    ]);

    private static expressionDefaults: Map<string, PossibleExpressions['requirements']> = new Map([
        [
            'spatialDistance',
            new SpatialDistanceExpression().defaultRequirements
        ],
        [
            'textRelevance',
            new TextRelevanceExpression().defaultRequirements
        ],
        [
            'jsonAggregate',
            new JsonAggregateExpression().defaultRequirements
        ]
    ]);

    public static getExpressionDefaultRequirements(
        type: string
    ): PossibleExpressions['requirements'] | undefined {
        return this.expressionDefaults.get(type);
    }

    /**
     * Registers a new expression builder at runtime.
     *
     * This is your “escape hatch” when core expressions
     * are not enough.
     *
     * @param type - expression.type value
     * @param builder - function that converts expression → expressionClause
     */
    public static registerExpressionBuilder<T extends PossibleExpressions>(
        type: string,
        builder: ExpressionBuilderFunction<T>
    ): void {
        this.expressionBuilders.set(type, builder as ExpressionBuilderFunction);
    }

    /**
     * Converts high-level expression definitions into normalized clauses.
     *
     * Any expression without a registered builder is ignored
     * (with a error, because silence is how bugs breed).
     */
    public static buildExpressionsPart(
        expressions: PossibleExpressions[]
    ): expressionClause[] {
        const queryParts: expressionClause[] = [];

        expressions.forEach(expression => {
            const builder = this.expressionBuilders.get(expression.type);

            if (builder) {
                queryParts.push(builder(expression));
            } else {
                throw new UnknownExpressionTypeError(expression.type);
            }
        });

        return queryParts;
    }

    /**
     * Filters expressions by evaluation phase.
     *
     * This is the core mechanism behind:
     * - base SELECT expressions
     * - projection (subquery) expressions
     */
    public static filterExpressionsByPhase(
        expressions: expressionClause[],
        phase: QueryEvaluationPhase
    ): expressionClause[] {

        const unsupportedPhases = expressions.filter(
            expr => expr.phase !== QueryEvaluationPhase.BASE &&
                expr.phase !== QueryEvaluationPhase.PROJECTION
        );

        if (unsupportedPhases.length > 0) {
            unsupportedPhases.forEach(expr => {
                throw new UnsupportedQueryPhaseError(expr.phase);
            });
        }

        return expressions.filter(expr => expr.phase === phase);
    }

    /**
     * Builds the SELECT clause for non-join queries.
     *
     * Rules:
     * - User-selected columns go first
     * - Base-phase expressions are appended
     * - Projection expressions are NOT included here
     */
    public static buildSelectClause(
        selectOption: string | undefined,
        expressions: expressionClause[]
    ): string {
        const flatExpressions = this.filterExpressionsByPhase(expressions, QueryEvaluationPhase.BASE);
        const selectColumns: string[] = [];

        if (selectOption && selectOption !== '*') {
            selectColumns.push(selectOption);
        }

        if (flatExpressions.length > 0) {
            selectColumns.push(
                flatExpressions
                    .map(expr => expr.baseExpressionClause)
                    .join(", ")
            );
        }

        return selectColumns.length > 0 ? selectColumns.join(", ") : '*';
    }

    /**
     * Builds the FROM clause.
     *
     * If projection expressions exist, the query MUST be wrapped,
     * because SQL does not allow filtering on aliases in the same SELECT.
     *
     * This is not optional. This is SQL being a gremlin.
     */
    public static buildFromClause(
        tableName: string,
        expressions: expressionClause[],
        // where?: QueryWhereCondition,
    ): { fromClause: string; hasWrapping: boolean } {
        const projectionExpressions =
            this.filterExpressionsByPhase(expressions, QueryEvaluationPhase.PROJECTION);

        if (projectionExpressions.length > 0) {
            const projectionClauses =
                projectionExpressions
                    .map(expr => expr.baseExpressionClause)
                    .join(", ");

            return {
                fromClause: `
                FROM (
                    SELECT *, ${projectionClauses}
                    FROM "${tableName}"
                ) AS subquery
            `.trim(),
                hasWrapping: true,
            };
        }

        return {
            fromClause: `FROM "${tableName}"`,
            hasWrapping: false,
        };
    }

    /**
     * Builds the SELECT clause for the OUTER query of a wrapped JOIN.
     *
     * This ensures:
     * - original column aliases are preserved
     * - projection expression aliases are exposed
     */
    public static buildJoinOuterSelectClause(
        columnAliases: string[],
        expressions: expressionClause[]
    ): string {
        const projectionExpressions =
            this.filterExpressionsByPhase(expressions, QueryEvaluationPhase.PROJECTION);

        const expressionAliases = projectionExpressions
            .map(expr => {
                const baseClause = expr.baseExpressionClause?.trim();
                const match = baseClause
                    ? baseClause.match(/AS\s+(.+)$/i)
                    : null;
                return match ? match[1] : null;
            })
            .filter(alias => alias !== null) as string[];

        return [...columnAliases, ...expressionAliases].join(',\n    ');
    }

    /**
     * Determines whether a JOIN query MUST be wrapped.
     *
     * Wrapping is required when:
     * - projection expressions exist
     * - AND those expressions are filtered or ordered on
     */
    public static shouldWrapJoinQuery(
        expressions: expressionClause[]
    ): boolean {
        const projectionExpressions =
            this.filterExpressionsByPhase(expressions, QueryEvaluationPhase.PROJECTION);

        return (
            projectionExpressions.length > 0
        );
    }
}
