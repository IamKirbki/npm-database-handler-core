export default interface IController<M> {
    index(): Promise<M[]>;
    show(id: string): Promise<M | undefined>;
    create(data: object): Promise<M>;
    update(id: string, data: object): Promise<void>;
    delete(id: string): Promise<void>;
}