import { Join, Query, DefaultQueryParameters, ExtraQueryParameters, QueryLayers, QueryContext } from "@core/index.js";
import QueryDecorator from "./QueryDecorator.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";

export default class JoinDecorator extends QueryDecorator {
    private fromTableName: string;
    private joins: Join | Join[];
    private query: Query;
    private options?: DefaultQueryParameters & ExtraQueryParameters;

    constructor(builder: IQueryBuilder, layer: QueryLayers, Query: Query) {
        if (!layer.base.from) {
            throw new Error("Base layer must specify 'from' table name for JoinDecorator.");
        }

        super(builder);

        this.fromTableName = layer.base.from;
        this.joins = layer.base.joins || [];
        this.query = Query;
        this.options = {
            orderBy: layer.final?.orderBy,
            limit: layer.final?.limit,
            offset: layer.final?.offset,
            groupBy: layer.pretty?.groupBy,
            blacklistTables: layer.final?.blacklistTables,
        };
    }

    async build(): Promise<QueryContext> {
        const context = await this.component.build();

        const selectExtensions = await this.buildJoinSelect();
        const joinPart = this.buildJoinPart();

        context.joinsSelect = selectExtensions;

        context.joins ??= [];
        context.joins.push(...joinPart);

        return context;
    }

    private async buildJoinSelect(): Promise<string[]> {
        const blacklist = this.options?.blacklistTables ?? [];
        const joinArray = Array.isArray(this.joins) ? this.joins : [this.joins];

        const mainCols = await this.query.TableColumnInformation(this.fromTableName);
        const mainSelect = mainCols
            .filter(() => !blacklist.includes(this.fromTableName))
            .map(col => `"${this.fromTableName}"."${col.name}" AS "${this.fromTableName}__${col.name}"`);

        const joinedSelects = await Promise.all(
            joinArray.map(async (join) => {
                if (blacklist.includes(join.fromTable)) return "";

                const cols = await this.query.TableColumnInformation(join.fromTable);
                return cols
                    .map(col => `"${join.fromTable}"."${col.name}" AS "${join.fromTable}__${col.name}"`)
                    .filter(col => col.trim() !== "")
            })
        );

        return [...mainSelect, ...joinedSelects.flat()].filter(s => s !== "").filter(Boolean);
    }

    private buildJoinPart(): string[] {
        const joinArray = Array.isArray(this.joins) ? this.joins : [this.joins];

        return joinArray.map(join => {
            const baseTable = join.baseTable || this.fromTableName;
            const onConditions = Array.isArray(join.on) ? join.on : [join.on];

            const onClause = onConditions.map(part => {
                const targetCol = Object.keys(part)[0];
                const sourceCol = Object.values(part)[0];
                return `${baseTable}.${sourceCol} = ${join.fromTable}.${targetCol}`;
            }).join(" AND ");

            return `${join.joinType} JOIN "${join.fromTable}" ON ${onClause}`;
        });
    }
}