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

export type PossibleExpressions = SpatialQueryExpression;

export type QueryExpression = {
    alias?: string;
    contributesTo?: "select" | "having" | "orderBy";
};

export type SpacialDistanceDefinition = {
    referencePoint: SpacialPoint;

    targetColumns: {
        lat: string;
        lon: string;
    };

    unit: 'km' | 'miles';
    earthRadius?: number;
    alias?: string;

    maxDistance?: number;
    orderByDistance?: 'ASC' | 'DESC';
};

export type SpatialQueryExpression = QueryExpression & {
    type: 'spatialDistance';
    parameters: SpacialDistanceDefinition;
}

export type SpacialPoint = {
    lat: number;
    lon: number;
}

export type QueryConstructorType = {
    tableName: string;
    query?: string;
    parameters?: QueryWhereCondition;
    adapterName?: string;
    recordFactory?: RecordFactory;
};