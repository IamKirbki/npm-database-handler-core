import {
    PossibleExpressions,
    SpatialQueryExpression,
    ExpressionBuilderFunction,
    expressionClause,
    TextRelevanceQueryExpression,
    JsonAggregateQueryExpression,
} from "@core/types/index.js";
import SpatialDistanceExpression from "./ExpressionBuilders/SpatialDistanceExpression.js";
import { UnknownExpressionTypeError } from "../Errors/ExpressionErrors/UnknownExpressionTypeError.js";
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
}
