import WebSocket from 'ws';

export default class WebSocketClient
{
    client: WebSocket;
    _onConnect: () => void;
    _onDisconnect: () => void;
    _onMessage: (message) => void;
    _onError: (err) => void;

    constructor(config: {host: string})
    {
        this.client = new WebSocket(config.host);

        this.client.on('open', () => {
            if(typeof this._onConnect === 'function') {
                this._onConnect();
            }
        });

        this.client.on('close', () => {
            if(typeof this._onDisconnect === 'function') {
                this._onDisconnect();
            }
        });

        this.client.on('message', (data) => {
            const rawMessage = Buffer.from(data).toString();
            const message = JSON.parse(rawMessage);
            
            if(typeof this._onMessage === 'function') {
                this._onMessage(message);
            }
        });

        this.client.on('error', (err) => {
            if(typeof this._onError === 'function') {
                this._onError(err);
            }
        });
    }

    /**
     * Close the connection
     */
    disconnect()
    {
        this.client.close();
    }

    /**
     * When a new client is connected
     * 
     * @param callback 
     */
    onConnect(callback: () => void): void
    {
        this._onConnect = callback;
    }
 
    /**
     * When a client is disconnected
     * 
     * @param callback 
     */
    onDisconnect(callback: () => void): void
    {
        this._onDisconnect = callback;
    }
 
    /**
     * When a message is received from a client
     * 
     * @param callback 
     */
    onMessage(callback: (message) => void): void
    {
        this._onMessage = callback;
    }
 
    /**
     * When there is an error with a client
     * 
     * @param callback 
     */
    onError(callback: (err) => void): void
    {
        this._onError = callback;
    }

    /**
     * Send a message to a socket server
     * 
     * @param {any} message Data to send 
     */
    sendMessage(message: any): void
    {
        const messageString = JSON.stringify(message);
        // const messageBuffer = Buffer.from(messageString);

        this.client.send(messageString);
    }
}