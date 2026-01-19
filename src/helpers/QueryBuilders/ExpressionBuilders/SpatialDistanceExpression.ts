import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import { expressionClause, SpatialQueryExpression } from "@core/types/index.js";

export default class SpatialDistanceExpression implements IExpressionBuilder {
    build(expression: SpatialQueryExpression): expressionClause {
        if (!this.validate(expression)) {
            throw new InvalidExpressionParametersError(
                "Invalid spatial distance expression parameters."
            );
        }

        const earthRadius =
            expression.parameters.earthRadius ??
            (expression.parameters.unit === 'km' ? 6371 : 3959);

        const baseExpressionClause = `
            ${earthRadius} * acos(
                cos(radians(${expression.parameters.referencePoint.lat}))
                * cos(radians(${expression.parameters.targetColumns.lat}))
                * cos(
                    radians(${expression.parameters.targetColumns.lon})
                    - radians(${expression.parameters.referencePoint.lon})
                )
                + sin(radians(${expression.parameters.referencePoint.lat}))
                * sin(radians(${expression.parameters.targetColumns.lat}))
            ) AS ${expression.parameters.alias}
        `.trim();

        const whereClause = expression.parameters.maxDistance
            ? `${expression.parameters.alias} <= ${expression.parameters.maxDistance}`
            : undefined;

        const orderByClause = expression.parameters.orderByDistance
            ? `${expression.parameters.alias} ${expression.parameters.orderByDistance}`
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping:
                expression.requirements.requiresSelectWrapping || false,
            whereClause,
            orderByClause
        };
    }

    validate(expression: SpatialQueryExpression): boolean {
        // Basic validation for spatial distance expression
        return (
            expression.type === 'spatialDistance' &&
            typeof expression.parameters.referencePoint.lat === 'number' &&
            typeof expression.parameters.referencePoint.lon === 'number' &&
            typeof expression.parameters.targetColumns.lat === 'string' &&
            typeof expression.parameters.targetColumns.lon === 'string' &&
            (expression.parameters.unit === 'km' ||
                expression.parameters.unit === 'miles') &&
            typeof expression.parameters.alias === 'string'
        );
    }
}