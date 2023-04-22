"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShardedAdapter = void 0;
const cluster_adapter_1 = require("./cluster-adapter");
const notepack_io_1 = require("notepack.io");
const util_1 = require("./util");
const debug_1 = require("debug");
const debug = (0, debug_1.default)("socket.io-redis");
const RETURN_BUFFERS = true;
function createShardedAdapter(pubClient, subClient, opts) {
    return function (nsp) {
        return new ShardedRedisAdapter(nsp, pubClient, subClient, opts);
    };
}
exports.createShardedAdapter = createShardedAdapter;
class ShardedRedisAdapter extends cluster_adapter_1.ClusterAdapter {
    constructor(nsp, pubClient, subClient, opts) {
        super(nsp);
        this.pubClient = pubClient;
        this.subClient = subClient;
        this.opts = Object.assign({
            channelPrefix: "socket.io",
        }, opts);
        this.channel = `${this.opts.channelPrefix}#${nsp.name}#`;
        this.responseChannel = `${this.opts.channelPrefix}#${nsp.name}#${this.uid}#`;
        const handler = (message, channel) => this.onRawMessage(message, channel);
        this.subClient.sSubscribe(this.channel, handler, RETURN_BUFFERS);
        this.subClient.sSubscribe(this.responseChannel, handler, RETURN_BUFFERS);
        this.cleanup = () => {
            return Promise.all([
                this.subClient.sUnsubscribe(this.channel, handler),
                this.subClient.sUnsubscribe(this.responseChannel, handler),
            ]);
        };
    }
    close() {
        this.cleanup();
    }
    publishMessage(message) {
        debug("publishing message of type %s to %s", message.type, this.channel);
        this.pubClient.sPublish(this.channel, this.encode(message));
        return Promise.resolve("");
    }
    publishResponse(requesterUid, response) {
        debug("publishing response of type %s to %s", response.type, requesterUid);
        this.pubClient.sPublish(`${this.channel}${requesterUid}#`, this.encode(response));
    }
    encode(message) {
        const mayContainBinary = [
            cluster_adapter_1.MessageType.BROADCAST,
            cluster_adapter_1.MessageType.BROADCAST_ACK,
            cluster_adapter_1.MessageType.FETCH_SOCKETS_RESPONSE,
            cluster_adapter_1.MessageType.SERVER_SIDE_EMIT,
            cluster_adapter_1.MessageType.SERVER_SIDE_EMIT_RESPONSE,
        ].includes(message.type);
        if (mayContainBinary && (0, util_1.hasBinary)(message.data)) {
            return (0, notepack_io_1.encode)(message);
        }
        else {
            return JSON.stringify(message);
        }
    }
    onRawMessage(rawMessage, channel) {
        let message;
        try {
            if (rawMessage[0] === 0x7b) {
                message = JSON.parse(rawMessage.toString());
            }
            else {
                message = (0, notepack_io_1.decode)(rawMessage);
            }
        }
        catch (e) {
            return debug("invalid format: %s", e.message);
        }
        if (channel.toString() === this.channel) {
            this.onMessage(message, "");
        }
        else {
            this.onResponse(message);
        }
    }
    serverCount() {
        if (this.pubClient.constructor.name === "Cluster" ||
            this.pubClient.isCluster) {
            return Promise.all(this.pubClient.nodes().map((node) => {
                node.sendCommand(["PUBSUB", "SHARDNUMSUB", this.channel]);
            })).then((values) => {
                let numSub = 0;
                values.map((value) => {
                    numSub += parseInt(value[1], 10);
                });
                return numSub;
            });
        }
        else {
            return this.pubClient
                .sendCommand(["PUBSUB", "SHARDNUMSUB", this.channel])
                .then((res) => parseInt(res[1], 10));
        }
    }
}
