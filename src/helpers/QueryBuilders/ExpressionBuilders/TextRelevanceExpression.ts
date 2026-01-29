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

        // Score: 3 = exact match, 2 = starts with, 1 = contains, 0 = no match
        const columnConcat = expression.parameters.targetColumns
            .map(col => `COALESCE(${col}, '')`)
            .join(" || ' ' || ");

        const baseExpressionClause = `(
            CASE 
                WHEN LOWER(${columnConcat}) = LOWER(@${expression.parameters.valueClauseKeywords[0]}) THEN 3
                WHEN LOWER(${columnConcat}) LIKE LOWER(@${expression.parameters.valueClauseKeywords[0]} || '%') THEN 2
                WHEN LOWER(${columnConcat}) LIKE LOWER('%' || @${expression.parameters.valueClauseKeywords[0]} || '%') THEN 1
                ELSE 0
            END
        ) AS ${expression.parameters.alias}`;

        const orderByClause = {
            column: expression.parameters.alias,
            direction: expression.parameters.orderByRelevance || 'ASC'
        }

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping:
                expression.requirements.requiresSelectWrapping || false,
            whereClause: expression.parameters.where,
            valueClauseKeywords: expression.parameters.valueClauseKeywords,
            orderByClause,
        };
    }

    validate(expression: TextRelevanceQueryExpression): boolean {
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