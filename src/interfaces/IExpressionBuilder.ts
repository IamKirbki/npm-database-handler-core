import { PossibleExpressions, expressionClause } from "@core/index";

export default interface IExpressionBuilder {
    build(expression: PossibleExpressions): expressionClause;
    validate?(expression: PossibleExpressions): boolean;
}