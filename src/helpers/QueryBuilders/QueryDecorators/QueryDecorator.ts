import IQueryBuilder from "@core/interfaces/IQueryBuilder";

export default abstract class QueryDecorator implements IQueryBuilder {
    protected component: IQueryBuilder;

    constructor(component: IQueryBuilder) {
        this.component = component;
    }

    abstract build(): Promise<string>;

    /**
     * Traverse the decorator chain to find a specific decorator type.
     * Returns the first match found.
     */
    protected findDecoratorInChain<T extends QueryDecorator>(type: new (...args: any[]) => T): T | null {
        let current: IQueryBuilder | undefined = this.component;
        
        while (current) {
            if (current instanceof type) {
                return current as T;
            }
            
            if (current instanceof QueryDecorator) {
                current = current.component;
            } else {
                break;
            }
        }
        
        return null;
    }
}