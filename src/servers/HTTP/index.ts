import express from 'express';
import http from 'http';

/**
 * Http server (for API updates and socket.io)
 * - Used to setup a web socket (socket.io) server
 * - Used to be able to send updates from the REST API server easily
 */

export default class Http
{
    port: string;
    server: http.Server;

    constructor(config: {port: string})
    {
        this.port = config.port;

        const app = express();
        this.server = http.createServer(app);
    }

    getServer(): http.Server
    {
        return this.server;
    }

    start(): void
    {
        // setup routes

        this.server.listen(this.port, () => {
            // console.log('listening on *:' + this.port);
        });
    }

    stop(): void
    {
        this.server.close();
    }
}