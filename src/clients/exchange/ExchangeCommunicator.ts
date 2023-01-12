
/**
 * Exchange communicator
 * 
 * - Use exchange APIs to get the needed information about setting up a web socket connection
 * - Setup one or more web socket connection(s) (with a ping/pong heartbeat to remain connected)
 * - Subscribe to different channels (as needed per exchange)
 * - Setup a callback method to pertain actions when updates are sent from exchange
 * - Setup re-connect (when connection is lost, automatically try to reconnect)
 * - Add, update or remove an exchange
 * - Add, update or remove a symbol for an exchange
 * - Add, update or remove a user's exchange account
 */

import RestAPI from "../../utilities/RestAPI";
import PubSub from "../../utilities/PubSub";
import Exchanges from "../../repositories/Exchanges";
import Log from "../../utilities/Log";

export default class ExchangeCommunicator
{
    _log: Log;
    _restAPI: RestAPI;
    _pubSub: PubSub;
    _exchangeClients: any;
    private _repos: {exchanges: Exchanges};

    constructor(log: Log, restAPI: RestAPI)
    {
        this._log = log;
        this._restAPI = restAPI;

        this._pubSub = new PubSub();

        this._exchangeClients = {};
    }

    /**
     * Start exchange connections
     */
    async connect()
    {
        if(typeof this._repos === 'undefined') {
            return false;
        }

        const exchanges = this._repos.exchanges.get();

        let context = this;

        // loop through each exchange
        let exchangeClientPromises = [];
        for(let iExchange in exchanges) {
            const exchange = exchanges[iExchange];

            // skip simple trader exchange for now
            if(exchange.name === 'SimpleTrader') {
                continue;
            }

            const exchangeClientPromise = new Promise(async (resolve, reject) => {
                // use a exchange client instance to setup the rest and socket api, if one is found for the given exchange
                import(__dirname + '/exchanges/' + exchange.name + '/ExchangeClient').then(({ExchangeClient}) => {

                    // check if exchange is supported
                    if(typeof ExchangeClient !== 'function') {
                        console.log('System: unsupported exchange: ' + exchange.name);

                        return resolve({
                            exchangeName: exchange.name,
                            connected: false
                        });
                    }

                    // TODO: get different rest api classes for different exchanges

                    context._exchangeClients[exchange.name] = new ExchangeClient(context._restAPI, context._pubSub, exchange);

                    // initialize channels and accounts
                    context._exchangeClients[exchange.name].connect().then(() => {
                        return resolve({
                            exchangeName: exchange.name,
                            connected: true
                        });
                    });
                });
            });

            exchangeClientPromises.push(exchangeClientPromise);
        }

        Promise.all(exchangeClientPromises).then((exchangeClientResults) => {

            // check if all are true
            let exchangesConnected = 0;
            for(let iExchange in exchangeClientResults) {
                const result = exchangeClientResults[iExchange];

                if(result.connected) {
                    exchangesConnected++;
                }
            }

            // emit on connect if all exchanges are connected successfully
            if(exchangesConnected === exchangeClientResults.length) {
                context._pubSub.emit('onConnect', exchangeClientResults);
            }
        });
    }

    /**
     * Update exchange connections
     */
    update(repos: {exchanges: Exchanges}): void
    {
        let context = this;
        this._repos = repos;

        const exchanges = this._repos.exchanges.get();

        /**
         * Loop through all exchanges
         */
        for(let iExchange in exchanges) {
            const exchange = exchanges[iExchange];

            /**
             * If exchange client already exists
             */
            if(typeof this._exchangeClients[exchange.name] !== 'undefined') {
                const exchangeClient = this._exchangeClients[exchange.name];

                /**
                 * If exchange client is not already connected
                 * - create socket connection
                 * - setup symbol channels
                 * - setup accounts managers
                 */
                if(!exchangeClient.isConnected()) {
                    exchangeClient.connect();
                }
                /**
                 * If exchange client is already connected
                 * - update symbols channels
                 * - update accounts managers
                 */
                else {
                    exchangeClient.update();
                }
            }
            /**
             * If exchange client not already exist
             * - import exchange client
             * - create exchange client instance
             * - initialize exchange client using symbols and accounts for exchange
             */
            else {
                // use a exchange client instance to setup the rest and socket api, if one is found for the given exchange
                import(__dirname + '/exchanges/' + exchange.name + '/ExchangeClient').then(({ExchangeClient}) => {

                    // check if exchange is supported
                    if(typeof ExchangeClient !== 'function') {
                        console.log('System: unsupported exchange: ' + exchange.name);
                        return;
                    }

                    context._exchangeClients[exchange.name] = new ExchangeClient(/*context._log,*/ context._restAPI, context._pubSub, exchange);

                    // initialize channels and accounts
                    context._exchangeClients[exchange.name].connect().then(() => {
                        
                    });
                });
            }
        }
    }

    /**
     * Stop exchange connections
     */
    disconnect(): void
    {
        // loop through each exchange and close the connection
        for(let eSI in this._exchangeClients) {
            this._exchangeClients[eSI].disconnect();
        }

        this._pubSub.emit('onDisconnect', {});
    }

    /**
     * When all exchange clients are connected
     * @param callback 
     */
    onConnect(callback: () => void)
    {
        this._pubSub.on('onConnect', callback);
    }

    /**
     * When all exchange clients are disconnected
     * @param callback 
     */
    onDisconnect(callback: () => void)
    {
        this._pubSub.on('onDisconnect', callback);
    }

    /**
     * When a single exchange is connected
     * @param callback 
     */
    onExchangeConnect(callback: (exchangeName: string) => void)
    {
        this._pubSub.on('onExchangeConnect', ({exchangeName}) => callback(exchangeName));
    }

    /**
     * When a single exchange is disconnected
     * @param callback 
     */
    onExchangeDisconnect(callback: (exchangeName: string, code: string, reason: string) => void)
    {
        this._pubSub.on('onExchangeDisconnect', ({exchangeName, code, reason}) => callback(exchangeName, code, reason));
    }

    /**
     * When a market ticker event update is received
     * 
     * @param callback 
     */
    onTickerUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._pubSub.on('onTickerUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.symbol, eventData.data)
        });
    }

    /**
     * When a chart data/kline event update is received
     * 
     * @param callback 
     */
    onKlineUpdate(callback: (exchange: string, interval: string, symbol: string, data: any) => void): void
    {
        this._pubSub.on('onKlineUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.interval, eventData.symbol, eventData.data)
        });
    }

    /**
     * When a level 2 orderbook update is received (price levels)
     * 
     * @param callback 
     */
    onOrderBookUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._pubSub.on('onOrderBookUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.symbol, eventData.data)
        });
    }

    /**
     * When a level 3 orderbook update is received (individual matches/orders)
     * 
     * @param callback 
     */
    onOrderUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._pubSub.on('onOrderUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.symbol, eventData.data)
        });
    }

    /**
     * When a order update for an account is received
     * 
     * @param callback 
     */
    onAccountTradeUpdate(callback: (exchange: string, accountId: string, data: any) => void): void
    {
        this._pubSub.on('onAccountTradeUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.accountId, eventData.data)
        });
    }

    /**
     * When a balance update for an account is received (deposit, withdraw, hold and margin)
     * 
     * @param callback 
     */
    onAccountBalanceUpdate(callback: (exchange: string, accountId: string, data: any) => void): void
    {
        this._pubSub.on('onAccountBalanceUpdate', (eventData) => {
            callback(eventData.exchangeName, eventData.accountId, eventData.data)
        });
    }
}