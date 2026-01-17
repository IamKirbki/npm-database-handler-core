import { PossibleExpressions } from "./query.js";

export type expressionClause = {
    /**
     * SQL fragment that produces the expression value.
     * Must include an alias if it needs to be referenced later.
     *
     * Example:
     *   6371 * acos(...) AS distance
     */
    baseExpressionClause?: string;

    /**
     * Determines *where* in the query lifecycle this expression is evaluated.
     *
     * - base:      Can live directly in SELECT
     * - projection: Must be computed in a subquery
     */
    phase?: 'base' | 'projection';

    /**
     * Signals that this expression cannot safely exist in the same
     * SELECT level where it is filtered or ordered on.
     *
     * This is the “SQL is dumb, wrap it” flag.
     */
    requiresWrapping?: boolean;

    /**
     * A WHERE condition that depends on the expression alias.
     *
     * Example:
     *   distance <= 10
     *
     * This MUST be applied in the outer query if the expression is projected.
     */
    whereClause?: string;

    /**
     * ORDER BY fragment derived from the expression.
     *
     * Example:
     *   distance ASC
     */
    orderByClause?: string;
};

/**
 * Generic function signature for expression builders.
 *
 * Each builder:
 * - receives a strongly-typed expression definition
 * - returns a normalized expressionClause
 */
export type ExpressionBuilderFunction<T extends PossibleExpressions = PossibleExpressions> =
/* eslint-disable-next-line no-unused-vars */
    (expression: T) => expressionClause;
