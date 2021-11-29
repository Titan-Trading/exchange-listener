// controllers
let TraderHandler    = require('./controllers/trader_controller');
let WebClientHandler = require('./controllers/webclient_controller');

class TCPHandler {
    constructor(io) {
        this.io = io;
        
        this.sockets = {};

        this.traderHandler    = new TraderHandler(io);
        this.webClientHandler = new WebClientHandler(io);
    }

    getSockets() {
        return this.sockets;
    }

    getHandler(type) {
        switch(type) {
            case 'trader':
                return this.traderHandler;
            case 'web_client':
                return this.webClientHandler;
        }
    }

    // handles the connection of a client
    onConnect(socket, type) {
        // add new client node if not found
        if(typeof this.sockets[socket.client.id] === 'undefined') {
            this.sockets[socket.client.id] = {
                type:      type,
                socketId:  socket.client.id,
                socket:    socket
            };
        }

        let handler = null;
        switch(type) {
            case 'trader':
                handler = this.traderHandler;
            break;
            case 'web_client':
                handler = this.webClientHandler;
            break;
        }

        handler.onConnect(socket);
    }

    // handles the handshake/auth of a client
    async onHandshake(socket, type, data) {
        let handler = null;
        switch(type) {
            case 'trader':
                handler = this.traderHandler;
            break;
            case 'web_client':
                handler = this.webClientHandler;
            break;
        }

        handler.onHandshake(socket, data);
    }

    // handles a update from a client
    async onUpdate(socket, type, data) {
        let handler = null;
        switch(type) {
            case 'trader':
                handler = this.traderHandler;
            break;
            case 'web_client':
                handler = this.webClientHandler;
            break;
        }

        handler.onUpdate(socket, data);
    }

    // handles disconnect of a client
    async onDisconnect(socket, type) {
        let handler = null;
        switch(type) {
            case 'trader':
                handler = this.traderHandler;
            break;
            case 'web_client':
                handler = this.webClientHandler;
            break;
        }

        handler.onDisconnect(socket);

        // remove socket from roster
        if(typeof this.sockets[socket.client.id] !== 'undefined') {
            delete this.sockets[socket.client.id];
        }
    }

    // handles error of a client
    onError(socket, type, err) {
        let handler = null;
        switch(type) {
            case 'trader':
                handler = this.traderHandler;
            break;
            case 'web_client':
                handler = this.webClientHandler;
            break;
        }

        handler.onError(socket, err);
    }
}

module.exports = TCPHandler;