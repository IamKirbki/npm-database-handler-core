import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import { expressionClause, JsonAggregateQueryExpression, PossibleExpressions, QueryEvaluationPhase } from "@core/index.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import QueryExpressionBuilder from "../QueryExpressionBuilder.js";

export default class JsonAggregateExpression implements IExpressionBuilder {
    build(expression: JsonAggregateQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new InvalidExpressionParametersError(
                "Invalid JSON aggregate expression parameters."
            );
        }

        const jsonBuildObjects: string = this.buildJsonBuildObject(expression);

        const baseExpressionClause = `JSON_AGG(
            ${jsonBuildObjects}
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
            groupByClause,
            havingClause: expression.parameters.having
        };
    }

    private buildJsonBuildObject(expression: JsonAggregateQueryExpression): string {
        const columnPart = expression.parameters.columns
            .map(col => `'${col}', "${expression.parameters.table}_${col}"`)
            .join(",\n  ");

        const computedPart = expression.parameters.computed?.length
            ? expression.parameters.computed
                .map(comp => {
                    const expr = {
                        type: comp.type,
                        parameters: {
                            ...comp.parameters,
                            isComputed: true
                        },
                        requirements: QueryExpressionBuilder.getExpressionDefaultRequirements(comp.type)!
                    };

                    const builder = QueryExpressionBuilder.buildExpressionsPart([expr as PossibleExpressions])[0];

                    return `'${comp.parameters.alias}', ${builder.baseExpressionClause?.split(" AS ")[0]}`;
                })
                .join(",\n  ")
            : "";

        const nestedPart = expression.parameters.nested?.length
            ? expression.parameters.nested
                .map(n => {
                    return `'${n.alias}', ${this.buildJsonBuildObject({
                        type: 'jsonAggregate',
                        parameters: {
                            table: n.table,
                            alias: n.alias,
                            columns: n.columns,
                            computed: n.computed,
                            nested: n.nested,
                            groupByColumns: []
                        },
                        requirements: this.defaultRequirements
                    })}`;
                })
                .join(",\n  ")
            : "";

        const parts = [columnPart, computedPart, nestedPart].filter(Boolean).join(",\n  ");

        return `JSON_BUILD_OBJECT(
                ${parts}
            )`;
    }

    validate(expression: JsonAggregateQueryExpression): boolean {
        if (expression.type !== 'jsonAggregate') {
            return false;
        }

        return (
            Array.isArray(expression.parameters.columns) &&
            typeof expression.parameters.table === 'string' &&
            Array.isArray(expression.parameters.groupByColumns) &&
            typeof expression.parameters.alias === 'string'
        );
    }

    get defaultRequirements(): JsonAggregateQueryExpression['requirements'] {
        return {
            phase: QueryEvaluationPhase.PROJECTION,
            cardinality: 'row',
            requiresAlias: true,
            requiresSelectWrapping: true
        };
    }
}