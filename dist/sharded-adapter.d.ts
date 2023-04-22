import { ClusterAdapter } from "./cluster-adapter";
export interface ShardedRedisAdapterOptions {
    channelPrefix?: string;
}
export declare function createShardedAdapter(pubClient: any, subClient: any, opts?: ShardedRedisAdapterOptions): (nsp: any) => ShardedRedisAdapter;
declare class ShardedRedisAdapter extends ClusterAdapter {
    private readonly pubClient;
    private readonly subClient;
    private readonly opts;
    private readonly channel;
    private readonly responseChannel;
    private readonly cleanup;
    constructor(nsp: any, pubClient: any, subClient: any, opts: ShardedRedisAdapterOptions);
    close(): Promise<void> | void;
    publishMessage(message: any): Promise<string>;
    publishResponse(requesterUid: any, response: any): void;
    private encode;
    private onRawMessage;
    serverCount(): Promise<number>;
}
export {};
