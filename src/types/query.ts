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

    expressions?: PossibleExpressions[];
};

// Base type for all query expressions
export type QueryExpression<T extends string = string> = {
    type: T;
    requirements: QueryExpressionRequirements;
};

// Union type of all supported expressions - add new types here
export type PossibleExpressions = SpatialQueryExpression; // | FutureExpression | AnotherExpression

export type QueryExpressionRequirements = {
    phase: QueryEvaluationPhase;
    requiresAlias?: boolean;
    requiresSelectWrapping?: boolean;
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

    maxDistance?: number;
    orderByDistance?: 'ASC' | 'DESC';
};

export type SpatialQueryExpression = QueryExpression<'spatialDistance'> & {
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

export type QueryEvaluationPhase =
    | 'base'        // can run in the main SELECT
    | 'projection'; // requires a wrapping SELECT

export type QueryConstructorType = {
    tableName: string;
    query?: string;
    parameters?: QueryWhereCondition;
    adapterName?: string;
    recordFactory?: RecordFactory;
};