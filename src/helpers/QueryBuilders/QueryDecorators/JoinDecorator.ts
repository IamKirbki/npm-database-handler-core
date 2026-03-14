import { Join, DefaultQueryParameters, ExtraQueryParameters, QueryLayers, QueryContext } from "@core/index.js";
import { QueryDecorator } from "./QueryDecorator.js";
import { IQueryBuilder } from "@core/interfaces/IQueryBuilder.js";
import { TableColumnInfo } from "@core/types/index.js";
import { InvalidOperationError } from "@core/helpers/Errors/ModelErrors/InvalidOperationError.js";

export class JoinDecorator extends QueryDecorator {
    private fromTableName: string;
    private joins: Join | Join[];
    private tableColumnsCache: Map<string, TableColumnInfo[]>;
    private options?: DefaultQueryParameters & ExtraQueryParameters;

    constructor(builder: IQueryBuilder, layer: QueryLayers, tableColumnInformation: Map<string, TableColumnInfo[]>) {
        if (!layer.base.from) {
            throw new InvalidOperationError("Base layer must specify 'from' table name for JoinDecorator.");
        }

        super(builder);

        this.fromTableName = layer.base.from;
        this.joins = layer.base.joins || [];
        this.tableColumnsCache = tableColumnInformation;
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

        const selectExtensions = this.buildJoinSelect();
        const joinPart = this.buildSqlJoinPart();

        context.joinsSelect = selectExtensions;

        context.joins ??= [];
        context.joins.push(...joinPart);

        return context;
    }

    private buildJoinSelect(): string[] {
        const blacklist = this.options?.blacklistTables || [];
        const joinArray = Array.isArray(this.joins) ? this.joins : [this.joins];

        const mainCols = this.tableColumnsCache.get(this.fromTableName) || [];
        const mainSelect = mainCols
            .filter(() => !blacklist.includes(this.fromTableName))
            .map(col => `"${this.fromTableName}"."${col.name}" AS "${this.fromTableName}__${col.name}"`);

        const innerSelects =
            joinArray.map((join) => {
                const alias = join.name || join.fromTable;
                if (blacklist.includes(join.fromTable) || blacklist.includes(alias)) return "";

                const cols = this.tableColumnsCache.get(join.fromTable) || [];
                return cols
                    .map(col => `"${alias}"."${col.name}" AS "${alias}__${col.name}"`)
                    .filter(col => col.trim() !== "")
            })

        return [...mainSelect, ...innerSelects.flat()].filter(s => s !== "").filter(Boolean);
    }

    private buildSqlJoinPart(): string[] {
        const joinArray = Array.isArray(this.joins) ? this.joins : [this.joins];

        return joinArray.map(join => {
            const baseTable = join.baseTable || this.fromTableName;
            const onConditions = Array.isArray(join.on) ? join.on : [join.on];
            const alias = join.name || join.fromTable;

            const onClause = onConditions.map(part => {
                const targetCol = Object.keys(part)[0];
                const sourceCol = Object.values(part)[0];
                return `${baseTable}.${sourceCol} = ${alias}.${targetCol}`;
            }).join(" AND ");

            return `${join.joinType} JOIN "${join.fromTable}" AS "${alias}" ON ${onClause}`;
        });
    }
}