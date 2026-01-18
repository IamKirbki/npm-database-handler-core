import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import { expressionClause, TextRelevanceQueryExpression } from "@core/types/index.js";

export default class TextRelevanceExpression implements IExpressionBuilder {
    build(expression: TextRelevanceQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new Error(
                "Invalid text relevance expression parameters."
            );
        }

        const baseExpressionClause = `ts_rank(
            to_tsvector(${expression.parameters.targetColumns.join(" || ' ' || ")}),
            to_tsquery('@${expression.parameters.whereClauseKeyword}')
        ) AS ${expression.parameters.alias}`;


        const whereClause = expression.parameters.minimumRelevance
            ? `${expression.parameters.alias} >= ${expression.parameters.minimumRelevance}`
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
            orderByClause
        };
    }

    validate(expression: TextRelevanceQueryExpression): boolean {
        // Basic validation for text relevance expression
        return (
            expression.type === 'textRelevance' &&
            typeof expression.parameters.searchTerm === 'string' &&
            Array.isArray(expression.parameters.targetColumns) &&
            expression.parameters.targetColumns.every(col => typeof col === 'string') &&
            typeof expression.parameters.alias === 'string'
        );
    }
}