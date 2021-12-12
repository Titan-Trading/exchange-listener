import net from 'net';
import {v4 as v4Uuid} from 'uuid';
import {
    getRandomHash,
    encrypt,
    decrypt
} from '../../utilities/helpers'

/**
 * TCP raw socket server
 * - communication with trading workers
 */

export default class TCPServer
{
    clients = {} as any;
    host: string;
    port: string;
    server: any;
    _onConnect: (socket: any) => void;
    _onDisconnect: (socket: any) => void;
    _onMessage: (socket: any, message: any) => void;
    _onError: (socket: any, err: any) => void;

    /**
     * Create new instance of a TCP server
     * 
     * @param config Server configuration
     */
    constructor(config: {host: string, port: string})
    {
        // setup configurations to be used later
        this.host = config.host;
        this.port = config.port;

        // create new instance of a TCP server
        this.server = net.createServer();
    }

    /**
     * Start listening for connections
     */
    start(): void
    {
        const context = this;

        // when a socket connection is made to the server
        this.server.on('connection', function(socket) {
            // generate socket id
            socket.id = v4Uuid();

            // generate encryption key
            const networkEncryptionKey = getRandomHash(32);

            // send it in handshake
            socket.write(JSON.stringify({
                commandId: 'HANDSHAKE',
                payload: {
                    nek: networkEncryptionKey
                }
            }));

            // store client with encryption key by socket id
            if(typeof this.client === 'undefined') {
                this.clients = {};
            }
            this.clients[socket.id] = {
                id: socket.id,
                nek: networkEncryptionKey,
                socket
            };

            // attach sending message method using encryption based on socket's encryption key
            socket.sendMessage = (message) => {
                socket.write(encrypt(this.clients[socket.id].nek, JSON.stringify(message)));
            };

            // call connected callback method
            if(typeof context._onConnect === 'function') {
                context._onConnect(socket);
            }
            
            // when a socket connection sends a message
            socket.on('data', (message) => {
                // get client and encryption key by socket id
                if(!this.clients[socket.id]) {
                    return;
                }

                // convert buffer to string
                message = Buffer.from(message).toString();

                // detect if json (not encrypted)
                if(!this.clients[socket.id].nek) {
                    message = JSON.parse(message);

                    return;
                }
                
                message = JSON.parse(decrypt(this.clients[socket.id].nek, message));

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
            socket.on('close', () => {
                // remove client and encryption key by socket id
                delete this.clients[socket.id];
            
                if(typeof context._onDisconnect === 'function') {
                    context._onDisconnect(socket);
                }
            });
        });

        this.server.listen(this.port, this.host);
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