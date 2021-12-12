import {Server} from 'socket.io';
import {v4} from 'uuid';
import http from 'http';

/**
 * Web Socket server (socket.io)
 * - update time series database from ticker, trades aggregated and individual trades (if supported) streams
 * - update clients with trade statuses
 * - update trading workers when new bot session or conditional trade is added or updated
 * - update trading workers when a new algorithm (bot or conditional trade) is added or updated
 */

export default class WebSocketServer
{
    httpServer: http.Server;
    server: Server;
    _onConnect: (socket) => void;
    _onDisconnect: (socket) => void;
    _onMessage: (socket, message) => void;
    _onError: (socket, err) => void;

    /**
     * Create new instance of a Web Socket server
     * 
     * @param config Server configuration
     */
    constructor(config: {httpServer: any})
    {
        this.httpServer = config.httpServer;
    }

    /**
     * Start listening for connections
     */
    start(): void
    {
        const context = this;

        // create new instance of a Web Socket server
        this.server = new Server(this.httpServer);

        // when a socket connection is made to the server
        this.server.on('connection', function(socket) {

            // call connected callback method
            if(typeof context._onConnect === 'function') {
                context._onConnect(socket);
            }
            
            // when a socket connection sends a message
            socket.on('message', (message) => {
                if(typeof context._onMessage === 'function') {
                    context._onMessage(socket, message);
                }
            });

            // when there is an error on a socket connection
            socket.on('error', (err) => {
                if(typeof context._onError === 'function') {
                    context._onError(socket, err);
                }
            });

            // when a socket connection is closed
            socket.on('disconnect', () => {
                if(typeof context._onDisconnect === 'function') {
                    context._onDisconnect(socket);
                }
            });
        });
    }

    /**
     * Stop listening for connections and disconnect all connected sockets
     */
    stop(): void
    {
        this.server.close();
    }

    /**
     * When a new client is connected
     * 
     * @param callback 
     */
    onConnect(callback: (socket) => void): void
    {
        this._onConnect = callback;
    }

    /**
     * When a client is disconnected
     * 
     * @param callback 
     */
    onDisconnect(callback: (socket) => void): void
    {
        this._onDisconnect = callback;
    }

    /**
     * When a message is received from a client
     * 
     * @param callback 
     */
    onMessage(callback: (socket, message) => void): void
    {
        this._onMessage = callback;
    }

    /**
     * When there is an error with a client
     * 
     * @param callback 
     */
    onError(callback: (socket, err) => void): void
    {
        this._onError = callback;
    }
}