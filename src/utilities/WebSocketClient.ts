import PubSub from './PubSub';
import WebSocket from 'ws';

export default class WebSocketClient
{
    private _client: WebSocket;
    private _eventBus: PubSub;

    constructor(config: {host: string})
    {
        this._eventBus = new PubSub();

        this._client = new WebSocket(config.host);

        this._client.on('open', () => {
            this._eventBus.emit('onConnect', {});
        });

        this._client.on('close', (code, reason) => {
            this._eventBus.emit('onDisconnect', {
                code,
                reason: Buffer.from(reason).toString()
            });
        });

        this._client.on('message', (data) => {
            this._eventBus.emit('onMessage', JSON.parse(Buffer.from(data).toString()));
        });

        this._client.on('error', (err) => {
            this._eventBus.emit('onError', err);
        });
    }

    /**
     * Close the connection
     */
    disconnect()
    {
        this._client.close();
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
    onDisconnect(callback: ({code, reason}) => void): void
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

    /**
     * Send a message to a socket server
     * 
     * @param {any} message Data to send 
     */
    sendMessage(message: any): void
    {
        const messageString = JSON.stringify(message);

        this._client.send(messageString);
    }
}