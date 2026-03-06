import IQueryBuilder from '@core/interfaces/IQueryBuilder.js';
import { QueryContext, QueryComparisonParameters } from '@core/types/query.js';
import QueryDecorator from './QueryDecorator.js';

export default class WhereDecorator extends QueryDecorator {
  private conditions: QueryComparisonParameters[];

  constructor(
    component: IQueryBuilder,
    conditions: QueryComparisonParameters[],
  ) {
    super(component);
    this.conditions = conditions;
  }

  async build(): Promise<QueryContext> {
    const context = await this.component.build();
    const combinedConditions = [...this.conditions];

    context.conditions ??= {};
    context.conditions.where ??= [];
    context.conditions.where.push(...combinedConditions);

    return context;
  }
}
