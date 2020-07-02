export declare class ConnectorRedisClient {
    private readonly redisClient;
    private readonly logger;
    constructor(opts: any);
    set<T>(key: string, value: T, expiresSecs?: number): Promise<string>;
    hmSet<T>(key: string, hashSet: {
        [key: string]: T;
    }, expiresSecs?: number): Promise<string>;
    get<T>(key: string): Promise<T | undefined>;
    getAll<T>(key: string): Promise<{
        [key: string]: T;
    } | undefined>;
    delete(key: string): Promise<number>;
    delHash(key: string, field: string): Promise<number>;
    quit(): Promise<void>;
    end(): void;
}
