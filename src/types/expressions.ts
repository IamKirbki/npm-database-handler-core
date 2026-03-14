import {
  OrderByDefinition,
  QueryComparisonParameters,
} from '@core/types/index.js';

export type expressionClause = {
  /**
   * SQL fragment that produces the expression value.
   * Must include an alias if it needs to be referenced later.
   *
   * Example:
   *   6371 * acos(...) AS distance
   */
  baseExpressionClause: string;

  selectClause?: string;

  /**
   * ORDER BY fragment derived from the expression.
   *
   * Example:
   *   distance ASC
   */
  orderByClause?: OrderByDefinition;

  whereClause?: QueryComparisonParameters[];

  valueClauseKeywords?: Record<string, string>;

  groupByClause?: string;

  havingClause?: QueryComparisonParameters[];
};

/**
 * Generic function signature for expression builders.
 *
 * Each builder:
 * - receives a strongly-typed expression definition
 * - returns a normalized expressionClause
 */
export type ExpressionBuilderFunction<
  T extends PossibleExpressions = PossibleExpressions,
> =
  /* eslint-disable-next-line no-unused-vars */
  (expression: T) => expressionClause;

// Base type for all query expressions
export type QueryExpression<T extends string = string> = {
  type: T;
};

// Union type of all supported expressions - add new types here
export type PossibleExpressions =
  | SpatialQueryExpression
  | TextRelevanceQueryExpression
  | JsonAggregateQueryExpression;

export type ComputedExpression<T extends string = string> = {
  type: T;
};

export type PossibleComputedExpressions =
  | SpatialComputedExpression
  | TextRelevanceComputedExpression;

export type SpatialDistanceDefinition = {
  referencePoint: SpatialPoint;

  targetColumns: SpatialPointColumns;

  unit: 'km' | 'miles';
  earthRadius?: number;
  alias: string;

  valueClauseKeywords: Record<string, string>;
  where?: QueryComparisonParameters[];

  maxDistance?: number;
  minDistance?: number;
  orderByDistance?: 'ASC' | 'DESC';
  isComputed?: boolean;
};

export type SpatialQueryExpression = QueryExpression<'spatialDistance'> & {
  parameters: SpatialDistanceDefinition;
};

export type SpatialComputedExpression =
  ComputedExpression<'spatialDistance'> & {
    parameters: SpatialDistanceDefinition;
  };

export type SpatialPointColumns = {
  lat: string;
  lon: string;
};

export type SpatialPoint = {
  lat: number;
  lon: number;
};

export type TextRelevanceDefinition = {
  targetColumns: string[];
  searchTerm: string;

  alias: string;
  where?: QueryComparisonParameters[];
  valueClauseKeywords: Record<string, string>;

  minimumRelevance?: number;
  orderByRelevance?: 'ASC' | 'DESC';
};

export type TextRelevanceQueryExpression = QueryExpression<'textRelevance'> & {
  parameters: TextRelevanceDefinition;
};

export type TextRelevanceComputedExpression =
  ComputedExpression<'textRelevance'> & {
    parameters: TextRelevanceDefinition;
  };

export type JsonAggregateDefinition<Tables extends string = string> = {
  /** Table this aggregate is built from */
  table: Tables;

  /** Columns selected from this table */
  columns: string[];

  nonTableColumns?: string[];

  /** GROUP BY columns required for this level */
  groupByColumns: string[];

  /** Alias of this JSON object / array */
  alias: string;

  /** Computed expressions */
  computed?: PossibleComputedExpressions[];

  /** Having clause */
  having?: QueryComparisonParameters[];

  /** Nested JSON objects or arrays */
  nested?: NestedJsonAggregateDefinition<Tables>[];
};

export type NestedJsonAggregateDefinition<Tables extends string = string> = {
  /** Table this aggregate is built from */
  table: Tables;

  /** Columns selected from this table */
  columns: string[];

  nonTableColumns?: string[];

  /** Alias of this JSON object / array */
  alias: string;

  /** Computed expressions */
  computed?: PossibleComputedExpressions[];

  /** Having clause */
  having?: QueryComparisonParameters[];

  /** Nested JSON objects or arrays */
  nested?: NestedJsonAggregateDefinition<Tables>[];
};

export type JsonAggregateQueryExpression = QueryExpression<'jsonAggregate'> & {
  parameters: JsonAggregateDefinition;
};

export type PossibleBaseExpressions =
  | SpatialQueryExpression
  | TextRelevanceQueryExpression;

export type PossiblePrettyExpressions = JsonAggregateQueryExpression;
