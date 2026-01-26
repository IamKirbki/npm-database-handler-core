// import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
// import { columnType } from "@core/types/index.js";
// import QueryDecorator from "./QueryDecorator";

// export default class ValuesDecorator extends QueryDecorator {
//     private values: columnType[];

//     constructor(component: IQueryBuilder, values: columnType[]) {
//         super(component);
//         this.values = values;
//     }

//     async build(): Promise<string> {
//         const baseQuery = await this.component.build();

//         const columns = Object.keys(this.values);
//         const placeholders = columns.map((col) => `@${col}`);

//         return `${baseQuery} ${columns.map((c) => `"${c}"`).join(", ")} VALUES (${placeholders.join(", ")})`;
//     }
// }