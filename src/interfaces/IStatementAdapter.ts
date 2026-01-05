export default interface IStatementAdapter {
    run(parameters?: object): Promise<unknown>;
    all(parameters?: object): Promise<unknown[]>;
    get(parameters?: object): Promise<unknown | undefined>;
    // Optional synchronous version for transactions (better-sqlite3 requirement)
    runSync?(parameters?: object): unknown;
}