import { QueryComparisonParameters, QueryIsEqualParameter, QueryWhereConditionType } from "@core/types";

export default class QueryWhereCondition {
    private conditions: QueryComparisonParameters[] = [];

    push(condition: QueryWhereConditionType): void {
        if (Array.isArray(condition)) {
            this.conditions.push(...condition);
        } else {
            this.conditions.push(...this.convertToComparisonParameters(condition));
        }
    }

    clear(): void {
        this.conditions = [];
    }

    get QueryIsEqualParameters(): QueryComparisonParameters[] {
        return this.conditions;
    }

    get QueryIsEqualParameter(): QueryIsEqualParameter {
        return this.convertToIsEqualParameter(this.conditions);
    }

    private convertToComparisonParameters(condition: QueryIsEqualParameter): QueryComparisonParameters[] {
        return Object.entries(condition).map(([column, value]) => ({
            column,
            operator: '=',
            value,
        }));
    }

    private convertToIsEqualParameter(condition: QueryComparisonParameters[]): QueryIsEqualParameter {
        return condition.reduce((acc, { column, value }) => {
            acc[column] = value;
            return acc;
        }, {} as QueryIsEqualParameter);
    }
}