import IO, { Socket } from 'socket.io-client';
import MsgPackParser from 'socket.io-msgpack-parser';
import JsonParser from 'socket.io-json-parser';
import PubSub from './PubSub';

interface ServerToClientEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
    message: (d: string, callback: (e: number) => void) => void;
    error: (d: string, callback: (e: number) => void) => void;
}

interface ClientToServerEvents {
    hello: () => void;
    message: () => void;
}

interface InterServerEvents {
    ping: () => void;
}

interface SocketData {
    name: string;
    age: number;
}


export default class SocketIOClient
{
    private _host: string;
    private _client: Socket<ServerToClientEvents, ClientToServerEvents>;
    private _eventBus: PubSub;
    _onConnect: () => void;
    _onDisconnect: () => void;
    _onMessage: (message) => void;
    _onError: (err) => void;

    constructor(config: {host: string})
    {
        this._eventBus = new PubSub();

        this._host = config.host;
    }

    /**
     * Open the connection
     */
    async connect(accessToken: string)
    {
        const context = this;

        this._client = IO(this._host, {
            auth: {
                token: accessToken
            },
            parser: JsonParser,
            transports: [ "websocket" ]
        });

        this._client.on('connect', () => {
            context._eventBus.emit('onConnect', {});
        });

        this._client.on('disconnect', (reason) => {
            context._eventBus.emit('onDisconnect', reason);
        });

        this._client.on('message', (data) => {
            context._eventBus.emit('onMessage', data);
        });

        this._client.on('error', (err) => {
            context._eventBus.emit('onError', err);
        });
    }

    /**
     * Close the connection
     */
    disconnect()
    {
        this._client.disconnect();
    }

    /**
     * Send a message to a socket server
     * 
     * @param {any} message Data to send 
     */
    sendMessage(message: any): void
    {
        if(!this._client) {
            return;
        }

        this._client.send(message);
    }

    /**
     * When a new client is connected
     * 
     * @param callback 
     */
    onConnect(callback: () => void): void
    {
        this._eventBus.on('onConnect', callback);
    }
 
    /**
     * When a client is disconnected
     * 
     * @param callback 
     */
    onDisconnect(callback: (reason: string) => void): void
    {
        this._eventBus.on('onDisconnect', callback);
    }
 
    /**
     * When a message is received from a client
     * 
     * @param callback 
     */
    onMessage(callback: (message) => void): void
    {
        this._eventBus.on('onMessage', callback);
    }
 
    /**
     * When there is an error with a client
     * 
     * @param callback 
     */
    onError(callback: (err) => void): void
    {
        this._eventBus.on('onError', callback);
    }
}