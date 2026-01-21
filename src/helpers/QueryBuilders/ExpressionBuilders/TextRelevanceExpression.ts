import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import { expressionClause, QueryEvaluationPhase, QueryExpressionRequirements, TextRelevanceQueryExpression } from "@core/types/index.js";

export default class TextRelevanceExpression implements IExpressionBuilder {
    build(expression: TextRelevanceQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new InvalidExpressionParametersError(
                "Invalid text relevance expression parameters."
            );
        }

        // Build universal LIKE-based relevance scoring
        // Score: 3 = exact match, 2 = starts with, 1 = contains, 0 = no match
        const columnConcat = expression.parameters.targetColumns
            .map(col => `COALESCE(${col}, '')`)
            .join(" || ' ' || ");

        const baseExpressionClause = `(
            CASE 
                WHEN LOWER(${columnConcat}) = LOWER(@${expression.parameters.whereClauseKeyword}) THEN 3
                WHEN LOWER(${columnConcat}) LIKE LOWER(@${expression.parameters.whereClauseKeyword} || '%') THEN 2
                WHEN LOWER(${columnConcat}) LIKE LOWER('%' || @${expression.parameters.whereClauseKeyword} || '%') THEN 1
                ELSE 0
            END
        ) AS ${expression.parameters.alias}`;


        const whereClause = expression.parameters.minimumRelevance !== undefined
            ? `${expression.parameters.alias} >= ${Number(expression.parameters.minimumRelevance)}`
            : undefined;

        const orderByClause = expression.parameters.orderByRelevance
            ? `${expression.parameters.alias} ${expression.parameters.orderByRelevance}`
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping:
                expression.requirements.requiresSelectWrapping || false,
            whereClause,
            orderByClause,
            whereClauseKeyword: expression.parameters.whereClauseKeyword
        };
    }

    validate(expression: TextRelevanceQueryExpression): boolean {
        // Basic validation for text relevance expression
        return (
            expression.type === 'textRelevance' &&
            typeof expression.parameters.searchTerm === 'string' &&
            Array.isArray(expression.parameters.targetColumns) &&
            expression.parameters.targetColumns.every(col => typeof col === 'string') &&
            typeof expression.parameters.alias === 'string' &&
            typeof expression.parameters.minimumRelevance == 'number'
        );
    }

    get defaultRequirements(): QueryExpressionRequirements {
        return {
            phase: QueryEvaluationPhase.PROJECTION,
            cardinality: 'row',
            requiresAlias: true,
            requiresSelectWrapping: true
        };
    }
}