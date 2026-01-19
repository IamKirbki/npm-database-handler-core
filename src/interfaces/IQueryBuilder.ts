export default interface IQueryBuilder {
    build(): Promise<string>;
}