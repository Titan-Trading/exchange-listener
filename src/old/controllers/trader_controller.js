let uuid = require('uuid');

const {encrypt, decrypt, getRandomHash} = require('../utilities/helpers');
// let Trade  = require('../../models/ConditionalTrade');
// let trading = require('../../trading/kernel');


class TraderHandler {
    constructor(io) {
        this.io = io;
        
        /**
         * Tracking online traders
         */
        this.traders = {};

        /**
         * Tracking trades sent to trader for a given exchange
         */
        this.tradesSentToTrader = {};
    }

    /**
     * Handles the socket connection of a client
     * @param {object} socket 
     */
    onConnect(socket) {
        // add new client node if not found
        if(typeof this.traders[socket.client.id] === 'undefined') {
            this.traders[socket.client.id] = {
                id:        null,
                online:    false,
                user:      null,
                socketId:  socket.client.id,
                socket:    socket,
                trades:    [] // TODO: load from database of stored trades
            };
        }

        console.log('Trader (' + socket.client.id + '): Online');
    }

    /**
     * Handles the socket handshake/auth of a client
     * @param {object} socket 
     * @param {object} data 
     */
    async onHandshake(socket, data) {
        // hardcoded api key and version string for now
        if((!data.apiKey || data.apiKey !== process.env.HANDSHAKE_KEY || data.version !== '0.0.1')) {
            console.log('ERROR: Trader (' + socket.client.id + '): Failed handshake, now disconnecting...');
            socket.disconnect();
            return;
        }
        
        try {
            const networkEncryptionKey = getRandomHash(32);
            const id                   = uuid();

            // set the trader as online, set current id
            this.traders[socket.client.id].id     = id;
            this.traders[socket.client.id].status = 'online';
            this.traders[socket.client.id].nek    = networkEncryptionKey;

            // send trader id to trader
            socket.emit('update', {
                commandId: 'TRADER_ID',
                payload: {
                    id,
                    nek: networkEncryptionKey
                }
            });

            // notify web clients
            this.notifyClients('traderOnline', {
                id,
                status: 'online',
                nek:    networkEncryptionKey
            });
        }
        catch(e) {
            console.log(e);
        }
    }

    /**
     * Handles a socket update from a client
     * @param {object} socket 
     * @param {object} data 
     */
    async onUpdate(socket, data) {
        /**
         * Detect encrypted message and decrypt it
         */
        if(typeof data !== 'object' && this.traders[socket.client.id].nek) {
            data = JSON.parse(decrypt(this.traders[socket.client.id].nek, data));
        }

        switch(data.commandId) {
            /**
             * TRADER CONTROL COMMANDS (from trader)
             */
            case 'TRADER_ID_SET':
                // set armed status to database
                this.traders[socket.client.id].status = 'armed';

                // start testing
                socket.emit('update', encrypt(this.traders[socket.client.id].nek, JSON.stringify({
                    commandId: 'TEST',
                    payload: {
                        start:   new Date(),
                        total:   Math.floor(Math.random() * 100),
                        current: 0
                    }
                })));
            break;
            case 'KILL_SUCCESS':
                // trader was killed
            break;

            /**
             * TRADER TEST COMMANDS (from trader)
             */
            case 'TEST_UPDATE':
                // update testing
                socket.emit('update', encrypt(this.traders[socket.client.id].nek, JSON.stringify({
                    commandId: 'TEST',
                    payload: {
                        start:   data.payload.start,
                        total:   data.payload.total,
                        current: data.payload.current+1
                    }
                })));
            break;
            case 'TEST_SUCCESS':
                // finish testing
                const duration = new Date() - new Date(data.payload.start);
                console.log('Trader (' + socket.client.id + '): Test of ' + data.payload.total + ' packets completed in ' + duration + 'ms (' + (duration / data.payload.total) + 'ms/packet)');
            break;

            /**
             * trader ORDER COMMANDS (from trader)
             */
            case 'ORDER_SUCCESS':
                // let addedTrade = await this.updateTrade(data.payload.tradeId, 'added', data.payload.orderId);

                // restart exchange price/loaded trades streams
                // trading.updateEntity('trade', addedTrade);

                // this.notifyClients('tradeAddedToExchange', {
                //     trade: addedTrade
                // });
            break;
            case 'ORDER_FAIL':
                // let failedTrade = await this.updateTrade(data.payload.tradeId, 'failed', null, data.payload.result.code + ': ' + data.payload.result.msg);

                // restart exchange price/loaded trades streams
                // trading.updateEntity('trade', failedTrade);

                // this.notifyClients('tradeFailed', {
                //     trade:  failedTrade,
                //     result: data.payload.result
                // });
            break;
            case 'ORDER_CANCEL_SUCCESS':
                // let cancelledTrade = await this.updateTrade(data.payload.tradeId, 'added', data.payload.orderId);

                // restart exchange price/loaded trades streams
                // trading.updateEntity('trade', cancelledTrade);

                // this.notifyClients('tradeRemovedFromExchange', {
                //     trade: cancelledTrade
                // });
            break;
            case 'ORDER_CANCEL_FAIL':
                // let failedCancelledTrade = await this.updateTrade(data.payload.tradeId, 'failed', null, data.payload.result.code + ': ' + data.payload.result.msg);

                // restart exchange price/loaded trades streams
                // trading.updateEntity('trade', failedCancelledTrade);

                // this.notifyClients('tradeCancelFailed', {
                //     trade:  failedTrade,
                //     result: data.payload.result
                // });
            break;


            default:
                console.log('Trader (' + socket.client.id + '): Unsupported Command, ' + data.commandId);
            break;
        }
    }

    /**
     * Handles socket disconnect of a client
     */
    async onDisconnect(socket) {
        console.log('Trader (' + socket.client.id + '): Offline');

        this.notifyClients('traderOffline', {
            id:     this.traders[socket.client.id].id,
            status: 'offline',
            nek:    this.traders[socket.client.id].nek
        });

        // remove socket from roster
        if(typeof this.traders[socket.client.id] !== 'undefined') {
            delete this.traders[socket.client.id];
        }
    }

    /**
     * Handles socket error of a client
     * @param {object} socket 
     * @param {object} err 
     */
    onError(socket, err) {
        console.log('ERROR: ' + err);
        // socket.disconnect();
    }

    /**
     * Get only traders that are armed and ready to accept trades
     */
    getArmedtraders() {
        let armedtraders = [];
        for(let itrader in this.traders) {
            if(this.traders[itrader].status == 'armed') armedtraders.push(this.traders[itrader]);
        }
        return armedtraders;
    }

    // 
    /**
     * Send an order to a trader node
     * @param {object} orderObj 
     */
    sendOrder(orderObj) {
        /**
         * Check if there are any traders that are armed
         */
        let armedtraders = this.getArmedtraders();
        if(!armedtraders.length) {
            console.log('NO TRADER TO SEND TRADE TO!');
            console.log('');
            return cb();
        }

        /**
         * Check to see if trade has been sent to a trader
         */
        if(typeof this.tradesSentToTrader[orderObj.tradeId] !== 'undefined') {
            console.log('TRADER ALREADY HAS TRADE!');
            console.log('');
            return cb();
        }
        this.tradesSentToTrader[orderObj.tradeId] = orderObj.order;

        /**
         * Select a trader (at random)
         */
        let trader = armedtraders[armedtraders.length * Math.random() << 0];

        /**
         * Send the trade command to place an order on the exchange
         */
        trader.socket.emit('update', encrypt(trader.nek, JSON.stringify({
            commandId: 'NEW_ORDER',
            payload: orderObj
        })));
    }

    /**
     * Notify all web clients
     * @param {string} commandId 
     * @param {object} payload 
     */
    notifyClients(commandId, payload) {
        this.io.of('/webClients').emit('update', {
            commandId,
            payload
        });
    }

    /**
     * Update a trade record in the database
     * @param {string} id 
     * @param {string} status 
     * @param {string} orderId 
     * @param {object} result 
     */
    /*async updateTrade(id, status, orderId=null, result=null) {
        return new Promise((resolve, reject) => {
            try {
                Trade.findOneAndUpdate({_id: id}, {status, orderId, result}, async (err, trade) => {
                    if(err) return reject(err);

                    let updatedTrade = await Trade.findById(id).populate('connectedExchange');

                    resolve(updatedTrade);
                });
            }
            catch(e) {
                return reject(e);
            }
        });
    }*/
}

module.exports = TraderHandler;