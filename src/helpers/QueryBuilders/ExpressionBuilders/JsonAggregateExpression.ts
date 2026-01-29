import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import { expressionClause, JsonAggregateQueryExpression, PossibleExpressions, QueryComparisonParameters, QueryEvaluationPhase } from "@core/index.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import QueryExpressionBuilder from "../QueryExpressionBuilder.js";
import QueryStatementBuilder from "../QueryStatementBuilder.js";

type JsonBuildObject = {
    sql: string;
    whereClause?: QueryComparisonParameters[];
    valueClauseKeywords?: string[];
}

export default class JsonAggregateExpression implements IExpressionBuilder {
    build(expression: JsonAggregateQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new InvalidExpressionParametersError(
                "Invalid JSON aggregate expression parameters."
            );
        }

        const jsonBuildObjects: JsonBuildObject = this.buildJsonBuildObject(expression);

        const baseExpressionClause = `JSON_AGG(
            ${jsonBuildObjects.sql}
        ) AS ${expression.parameters.alias}`;

        const groupByClause = expression.parameters.groupByColumns.length > 0
            ? expression.parameters.groupByColumns
                .map(col => col.includes(".") ? `"${col.replace(".", "__")}"` : `"${col}"`)
                .join(", ")
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping: expression.requirements.requiresSelectWrapping || false,
            groupByClause,
            whereClause: jsonBuildObjects.whereClause,
            valueClauseKeywords: jsonBuildObjects.valueClauseKeywords,
            havingClause: expression.parameters.having
        };
    }

    private buildJsonBuildObject(expression: JsonAggregateQueryExpression): JsonBuildObject {
        const columnPart = expression.parameters.columns
            .map(col => `'${col}', "${expression.parameters.table}_${col}"`)
            .join(",\n  ");

        const computedPart = expression.parameters.computed?.length
            ? expression.parameters.computed
                .map(comp => {
                    const valueClauseKeywords = [`${comp.parameters.alias}_lat`, `${comp.parameters.alias}_lon`];
                    
                    const expr = {
                        type: comp.type,
                        parameters: {
                            ...comp.parameters,
                            valueClauseKeywords: comp.type === 'spatialDistance' ? valueClauseKeywords : comp.parameters.valueClauseKeywords,
                            isComputed: true
                        },
                        requirements: QueryExpressionBuilder.getExpressionDefaultRequirements(comp.type)!
                    };

                    const builder = QueryExpressionBuilder.buildExpressionsPart([expr as PossibleExpressions])[0];

                    return {
                        sql: `'${comp.parameters.alias}', ${builder.baseExpressionClause?.split(" AS ")[0]}`,
                        whereClause: builder.whereClause,
                        valueClauseKeywords: builder.valueClauseKeywords
                    };
                }) : [];

        const computedSqlPart = computedPart.length
            ? computedPart.map(c => c.sql).join(",\n  ")
            : "";

        const whereClauses = computedPart
            .flatMap(c => c.whereClause ? QueryStatementBuilder.normalizeQueryConditions(c.whereClause) : []);

        const valueClauseKeywords = computedPart
            .flatMap(c => c.valueClauseKeywords || []);

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
                    }).sql}`;
                })
                .join(",\n  ")
            : "";

        const parts = [columnPart, computedSqlPart, nestedPart].filter(Boolean).join(",\n  ");

        return {
            sql: `JSON_BUILD_OBJECT(
                ${parts}
            )`,
            whereClause: whereClauses,
            valueClauseKeywords: valueClauseKeywords
        };
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