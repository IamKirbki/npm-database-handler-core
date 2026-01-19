import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import { Join, Query, DefaultQueryParameters, ExtraQueryParameters } from "@core/index.js";
import QueryDecorator from "./QueryDecorator.js";

export default class JoinDecorator extends QueryDecorator {
    private fromTableName: string;
    private joins: Join | Join[];
    private query: Query;
    private options?: DefaultQueryParameters & ExtraQueryParameters;

    constructor(
        component: IQueryBuilder,
        fromTableName: string,
        joins: Join | Join[],
        query: Query,
        options?: DefaultQueryParameters & ExtraQueryParameters
    ) {
        super(component);
        this.fromTableName = fromTableName;
        this.joins = joins;
        this.query = query;
        this.options = options;
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();

        const selectExtensions = await this.buildJoinSelect();
        const joinPart = this.buildJoinPart();

        let sql = baseQuery.replace(/SELECT\s+/i, `SELECT ${selectExtensions}`);
        sql = sql.replace("*", "")

        if (sql.includes("WHERE")) {
            sql = sql.replace(/\s+WHERE/i, ` ${joinPart} WHERE`);
        } else {
            sql = `${sql} ${joinPart}`;
        }

        return sql;
    }

    private async buildJoinSelect(): Promise<string> {
        const blacklist = this.options?.blacklistTables ?? [];
        const joinArray = Array.isArray(this.joins) ? this.joins : [this.joins];

        const mainCols = await this.query.TableColumnInformation(this.fromTableName);
        const mainSelect = mainCols
            .filter(() => !blacklist.includes(this.fromTableName))
            .map(col => `"${this.fromTableName}"."${col.name}" AS "${this.fromTableName}__${col.name}"`)
            .join(", ");

        const joinedSelects = await Promise.all(
            joinArray.map(async (join) => {
                if (blacklist.includes(join.fromTable)) return "";

                const cols = await this.query.TableColumnInformation(join.fromTable);
                return cols
                    .map(col => `"${join.fromTable}"."${col.name}" AS "${join.fromTable}__${col.name}"`)
                    .filter(col => col.trim() !== "")
                    .join(", ");
            })
        );

        return [mainSelect, ...joinedSelects].filter(s => s !== "").filter(Boolean).join(", ");
    }

    private buildJoinPart(): string {
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
        }).join(" ");
    }
}