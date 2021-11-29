
const {encrypt, decrypt} = require('../utilities/helpers');

class WebClientHandler {
    constructor(io) {
        this.io = io;
        
        this.sockets = {};
    }

    // handles the connection of a client
    onConnect(socket) {
        // add new client node if not found
        if(typeof this.sockets[socket.client.id] === 'undefined') {
            this.sockets[socket.client.id] = {
                id:        null,
                online:    false,
                user:      null,
                socketId:  socket.client.id,
                socket:    socket,
                trades:    [] // TODO: load from database of stored trades
            };
        }

        console.log('web client online: ' + socket.client.id);
    }

    // handles the handshake/auth of a client
    async onHandshake(socket, data) {
        // do auth

        // failed auth results in forced disconnect

        // get all coin balances from all connected exchanges
        // add up all coin balances in BTC
        // convert BTC total holdings estimate into USD value
        // set the worker as online
        this.sockets[socket.client.id].user = data.user;

        // send initial data after handshake is authenticated
        socket.emit('update', {
            commandId: 'initData',
            payload: {
                serverTime: new Date(),
                estimatedHoldingsInBTC: 100.00,
                estimatedHoldingsInUSD: 0.00
            }
        });
    }

    // handles a update from a client
    async onUpdate(socket, data) {
        // detect encrypted message, decrypt
        if(typeof data !== 'object' && this.sockets[socket.client.id].nek) {
            data = JSON.parse(decrypt(this.sockets[socket.client.id].nek, data));
        }

        switch(data.commandId) {
            default:
                console.log('Unsupported Command: ' + data.commandId);
            break;
        }
    }

    // handles disconnect of a client
    async onDisconnect(socket) {
        console.log('web client offline: ' + socket.client.id);

        // remove socket from roster
        if(typeof this.sockets[socket.client.id] !== 'undefined') delete this.sockets[socket.client.id];
    }

    // handles error of a client
    onError(socket, err) {
        console.log('ERROR: ' + err);
        socket.disconnect();
    }

    // send trade updates to all web clients
    sendTradeUpdate(trade) {
        this.io.of('/webClients').emit('update', {
            commandId: 'tradeTriggered',
            payload: {
                trade: trade
            }
        });
    }
}

module.exports = WebClientHandler;