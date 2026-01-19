import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import { expressionClause, JsonAggregateQueryExpression } from "@core/index.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";

export default class JsonAggregateExpression implements IExpressionBuilder {
    build(expression: JsonAggregateQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new InvalidExpressionParametersError(
                "Invalid JSON aggregate expression parameters."
            );
        }

        // Build JSON_BUILD_OBJECT key-value pairs from targetColumns
        const jsonFields = expression.parameters.targetColumns
            .map(col => `'${col}', "${expression.parameters.targetTable}"."${col}"\n`)
            .join(", ");

        const baseExpressionClause = `JSON_AGG(
            JSON_BUILD_OBJECT(
                ${jsonFields}
            )
        ) AS ${expression.parameters.alias}`;

        const groupByClause = expression.parameters.groupByColumns.length > 0
            ? expression.parameters.groupByColumns
                .map(col => `"${col}"`)
                .join(", ")
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping: expression.requirements.requiresSelectWrapping || false,
            groupByClause
        };
    }

    validate(expression: JsonAggregateQueryExpression): boolean {
        if (expression.type !== 'jsonAggregate') {
            return false;
        }

        return (
            Array.isArray(expression.parameters.targetColumns) &&
            expression.parameters.targetColumns.length > 0 &&
            typeof expression.parameters.targetTable === 'string' &&
            Array.isArray(expression.parameters.groupByColumns) &&
            typeof expression.parameters.alias === 'string'
        );
    }
}