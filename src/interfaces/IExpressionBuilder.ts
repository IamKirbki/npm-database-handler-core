import { PossibleComputedExpressions, PossibleExpressions, expressionClause } from "@core/index";

export default interface IExpressionBuilder {
    build(expression: PossibleExpressions | PossibleComputedExpressions): expressionClause;
    validate?(expression: PossibleExpressions | PossibleComputedExpressions): boolean;
    get defaultRequirements(): PossibleExpressions['requirements'];
}