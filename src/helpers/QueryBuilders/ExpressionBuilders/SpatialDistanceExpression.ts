import InvalidExpressionParametersError from "@core/helpers/Errors/ExpressionErrors/InvalidExpressionParametersError.js";
import IExpressionBuilder from "@core/interfaces/IExpressionBuilder.js";
import { expressionClause, QueryEvaluationPhase, SpatialQueryExpression } from "@core/types/index.js";

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

        const isComputed = expression.parameters.isComputed;

        const baseExpressionClause = `
            ${earthRadius} * acos(
                cos(radians(${expression.parameters.referencePoint.lat}))
                * cos(radians(${isComputed ? expression.parameters.targetColumns.lat.replace(".", "_") : `${expression.parameters.targetColumns.lat}`}))
                * cos(
                    radians(${isComputed ? expression.parameters.targetColumns.lon.replace(".", "_") : `${expression.parameters.targetColumns.lon}`})
                    - radians(${expression.parameters.referencePoint.lon})
                )
                + sin(radians(${expression.parameters.referencePoint.lat}))
                * sin(radians(${isComputed ? expression.parameters.targetColumns.lat.replace(".", "_") : `${expression.parameters.targetColumns.lat}`}))
            ) AS ${expression.parameters.alias}
        `.trim();

        const orderByClause = expression.parameters.orderByDistance
            ? `${expression.parameters.alias} ${expression.parameters.orderByDistance}`
            : undefined;

        return {
            baseExpressionClause,
            phase: expression.requirements.phase,
            requiresWrapping:
                expression.requirements.requiresSelectWrapping || false,
            whereClause: [{
                column: expression.parameters.alias,
                operator: '<=',
                value: expression.parameters.maxDistance
            }],
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

    get defaultRequirements(): SpatialQueryExpression['requirements'] {
        return {
            phase: QueryEvaluationPhase.PROJECTION,
            cardinality: 'row',
            requiresAlias: true,
            requiresSelectWrapping: true
        };
    }
}