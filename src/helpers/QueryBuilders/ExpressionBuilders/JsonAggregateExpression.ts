import { InvalidExpressionParametersError } from '@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js';
import {
  expressionClause,
  JsonAggregateQueryExpression,
  PossibleExpressions,
  QueryComparisonParameters,
} from '@core/types/index.js';
import { IExpressionBuilder } from '@core/interfaces/IExpressionBuilder.js';
import { QueryExpressionBuilder } from '../QueryExpressionBuilder.js';

type JsonBuildObject = {
  sql: string;
  whereClause?: QueryComparisonParameters[];
  valueClauseKeywords?: Record<string, string>;
};

export class JsonAggregateExpression implements IExpressionBuilder {
  build(expression: JsonAggregateQueryExpression): expressionClause {
    if (!this.validate(expression)) {
      throw new InvalidExpressionParametersError(
        'Invalid JSON aggregate expression parameters.',
      );
    }

    const jsonBuildObjects: JsonBuildObject =
      this.buildJsonBuildObject(expression);

    const baseExpressionClause = `JSON_AGG(
            ${jsonBuildObjects.sql}
        ) AS ${expression.parameters.alias}`;

    const groupByClause =
      expression.parameters.groupByColumns.length > 0
        ? expression.parameters.groupByColumns
            .map((col) =>
              col.includes('.') ? `"${col.replace('.', '__')}"` : `"${col}"`,
            )
            .join(', ')
        : undefined;

    return {
      baseExpressionClause,
      groupByClause,
      whereClause: jsonBuildObjects.whereClause,
      valueClauseKeywords: jsonBuildObjects.valueClauseKeywords,
      havingClause: expression.parameters.having,
    };
  }

  private buildJsonBuildObject(
    expression: JsonAggregateQueryExpression,
  ): JsonBuildObject {
    const columnPart = expression.parameters.columns
      .map((col) => `'${col}', "${expression.parameters.table}_${col}"`)
      .join(',\n  ');

    const computedPart = expression.parameters.computed?.length
      ? expression.parameters.computed.map((comp) => {
          const valueClauseKeywords = {
            lat: `${comp.parameters.alias}_lat`,
            lon: `${comp.parameters.alias}_lon`,
          };

          const expr = {
            type: comp.type,
            parameters: {
              ...comp.parameters,
              valueClauseKeywords:
                comp.type === 'spatialDistance'
                  ? valueClauseKeywords
                  : comp.parameters.valueClauseKeywords,
              isComputed: true,
            },
          };

          const builder = QueryExpressionBuilder.buildExpressionsPart([
            expr as PossibleExpressions,
          ])[0];

          const prefixedKeywords: Record<string, string> = {};
          if (builder.valueClauseKeywords) {
            for (const [key, value] of Object.entries(
              builder.valueClauseKeywords,
            )) {
              prefixedKeywords[`${comp.parameters.alias}_${key}`] = value;
            }
          }

          return {
            sql: `'${comp.parameters.alias}', ${builder.baseExpressionClause?.split(' AS ')[0]}`,
            whereClause: builder.whereClause,
            valueClauseKeywords: prefixedKeywords,
          };
        })
      : [];

    const computedSqlPart = computedPart.length
      ? computedPart.map((c) => c.sql).join(',\n  ')
      : '';

    const whereClauses = computedPart.flatMap((c) =>
      c.whereClause ? c.whereClause : [],
    );

    const valueClauseKeywords = computedPart.reduce(
      (acc, c) => ({
        ...acc,
        ...(c.valueClauseKeywords || {}),
      }),
      {} as Record<string, string>,
    );

    const nestedPart = expression.parameters.nested?.length
      ? expression.parameters.nested
          .map((n) => {
            return `'${n.alias}', ${
              this.buildJsonBuildObject({
                type: 'jsonAggregate',
                parameters: {
                  table: n.table,
                  alias: n.alias,
                  columns: n.columns,
                  computed: n.computed,
                  nested: n.nested,
                  groupByColumns: [],
                },
              }).sql
            }`;
          })
          .join(',\n  ')
      : '';

    const parts = [columnPart, computedSqlPart, nestedPart]
      .filter(Boolean)
      .join(',\n  ');

    return {
      sql: `JSON_BUILD_OBJECT(
                ${parts}
            )`,
      whereClause: whereClauses,
      valueClauseKeywords: valueClauseKeywords,
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
}
