import { RecordFactory } from "@core/index.js";

export type QueryIsEqualParameter = {
    [key: string]: QueryValues;
};

export type QueryComparisonParameters = {
    column: string;
    operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN' | 'NOT IN';
    value: QueryValues;
};

export type QueryWhereCondition = QueryIsEqualParameter | QueryComparisonParameters[];

export type QueryValues = string | number | boolean | null | bigint | Date;

export type DefaultQueryParameters = {
    select?: string;
    where?: QueryWhereCondition;
};

export type ExtraQueryParameters = {
    orderBy?: string;
    limit?: number;
    offset?: number;
    groupBy?: string;

    expressions?: PossibleExpressions[];
    blacklistTables?: string[];
};

// Base type for all query expressions
export type QueryExpression<T extends string = string> = {
    type: T;
    requirements: QueryExpressionRequirements;
};

// Union type of all supported expressions - add new types here
export type PossibleExpressions =
    SpatialQueryExpression |
    TextRelevanceQueryExpression |
    JsonAggregateQueryExpression;

export type ComputedExpression<T extends string = string> = {
    type: T;
}

export type PossibleComputedExpressions =
    SpatialComputedExpression |
    TextRelevanceComputedExpression;

export type QueryExpressionRequirements = {
    phase: QueryEvaluationPhase;

    cardinality: 'row' | 'aggregate';

    select?: string;
    where?: string;
    having?: string;
    orderBy?: string;

    requiresAlias: boolean;
    requiresSelectWrapping: boolean;
};

export type QueryShape =
    | { kind: 'flat' }
    | { kind: 'wrapped'; reason: 'projection-expressions' };

export type SpatialDistanceDefinition = {
    referencePoint: SpatialPoint;

    targetColumns: SpatialPointColumns;

    unit: 'km' | 'miles';
    earthRadius?: number;
    alias: string;

    maxDistance: number;
    orderByDistance?: 'ASC' | 'DESC';
};

export type SpatialQueryExpression = QueryExpression<'spatialDistance'> & {
    parameters: SpatialDistanceDefinition;
};

export type SpatialComputedExpression = ComputedExpression<'spatialDistance'> & {
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
    whereClauseKeyword?: string;

    minimumRelevance?: number;
    orderByRelevance?: 'ASC' | 'DESC';
};

export type TextRelevanceQueryExpression = QueryExpression<'textRelevance'> & {
    parameters: TextRelevanceDefinition;
};

export type TextRelevanceComputedExpression = ComputedExpression<'textRelevance'> & {
    parameters: TextRelevanceDefinition;
};

export type JsonAggregateDefinition<Tables extends string = string> = {
    /** Table this aggregate is built from */
    table: Tables;

    /** Columns selected from this table */
    columns: string[];

    /** GROUP BY columns required for this level */
    groupByColumns: string[];

    /** Alias of this JSON object / array */
    alias: string;

    /** Computed expressions */
    computed?: PossibleComputedExpressions[];

    /** Having clause */
    having?: string;

    /** Nested JSON objects or arrays */
    nested?: NestedJsonAggregateDefinition<Tables>[];
};

export type NestedJsonAggregateDefinition<Tables extends string = string> = {
    /** Table this aggregate is built from */
    table: Tables;

    /** Columns selected from this table */
    columns: string[];

    /** Alias of this JSON object / array */
    alias: string;

    /** Computed expressions */
    computed?: PossibleComputedExpressions[];

    /** Having clause */
    having?: string;

    /** Nested JSON objects or arrays */
    nested?: NestedJsonAggregateDefinition<Tables>[];
}

export type JsonAggregateQueryExpression = QueryExpression<'jsonAggregate'> & {
    parameters: JsonAggregateDefinition;
};

export enum QueryEvaluationPhase {
    BASE = 'base',
    PROJECTION = 'projection',
    LATERAL = 'lateral'
}

export type QueryConstructorType = {
    tableName: string;
    query?: string;
    parameters?: QueryWhereCondition;
    adapterName?: string;
    recordFactory?: RecordFactory;
};