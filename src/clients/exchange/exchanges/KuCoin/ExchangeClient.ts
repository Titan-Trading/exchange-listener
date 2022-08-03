import { randomUUID } from "crypto";
import { getTickerSymbol } from "../../../../utilities/helpers";
import RestAPI from "../../../../utilities/RestAPI";
import PubSub from "../../../../utilities/PubSub";
import WebSocketClient from "../../../../utilities/WebSocketClient";
import ExchangeClientInterface from "../ExchangeClientInterface";
import KuCoinRestAPI from "./RestAPI";
import ChannelManager from "./ChannelManager";
import AccountManager from "./AccountManager";
import KlineChannel from "./channel_types/KlineChannel";
import OrderBookChannel from "./channel_types/OrderBookChannel";
import TickerChannel from "./channel_types/TickerChannel";
import MatchExecutionChannel from "./channel_types/MatchExecutionChannel";

/**
 * Exchange client for communicating with KuCoin exchange
 */

export class ExchangeClient implements ExchangeClientInterface
{
    private _restAPI: RestAPI;
    private _eventBus: PubSub;
    private _isConnected: boolean = false;
    private _client: KuCoinRestAPI;
    private _mainSocket: WebSocketClient;
    private _channelManager: ChannelManager;
    private _exchange: {id: number, name: string, symbol_template: string};
    private _data: any;
    private _accountManagers: any;

    constructor(restAPI: RestAPI, eventBus: PubSub, exchange: {id: number, name: string, symbol_template: string})
    {
        this._restAPI = restAPI;

        this._eventBus = eventBus;

        this._exchange = exchange;

        this._data = {
            symbols: {},
            accounts: {}
        };

        this._accountManagers = {};
    }

    /**
     * Use rest api data to initalize connection to an exchange
     * @param data 
     */
    async connect()
    {
        let context = this;

        /**
         * Get symbols and accounts for the exchange from the rest api
         */
        this._data.symbols = await this._restAPI.getTickerSymbols(this._exchange.id);
        this._data.accounts = await this._restAPI.getExchangeAccounts(this._exchange.id);

        console.log('Symbols loaded: ', this._data.symbols.length);
        console.log('Accounts loaded: ', this._data.accounts.length);

        /**
         * Create REST API client for exchange api
         */
        this._client = new KuCoinRestAPI('https://api.kucoin.com');

        /**
         * Get initial data from exchange api
         */
        const initData = await this._client.getInitialData();

        const webSocketToken = initData.data.token;
        const webSocketHost = initData.data.instanceServers[0].endpoint;
        const webSocketPingInterval = initData.data.instanceServers[0].pingInterval;
        const webSocketPingTimeout = initData.data.instanceServers[0].pingTimeout;

        /**
         * Connect to websocket api for exchange (main connection)
         */
        this._mainSocket = new WebSocketClient({host: webSocketHost + '?token=' + webSocketToken});

        /**
         * Pass socket client to channel manager
         * - setup all needed channels
         * - subscribe/connect to all needed channels
         */
        this._channelManager = new ChannelManager();

        /**
         * When successfully connect to websocket api
         */
        this._mainSocket.onConnect(() => {
            console.log('System: connected to ' + context._exchange.name);

            context._isConnected = true;

            context._eventBus.emit('onExchangeConnect', {exchangeName: context._exchange.name});
        });

        /**
         * When disconnected from websocket api
         */
        this._mainSocket.onDisconnect(({code, reason}) => {
            console.log('System: disconnected from ' + context._exchange.name + ' : ' + reason + ' (' + code + ')');

            context._isConnected = false;

            context._eventBus.emit('onExchangeDisconnect', {
                exchangeName: context._exchange.name,
                code,
                reason
            });
        });

        /**
         * Loop through all the symbols for the exchange
         * - convert currency pair into exchange symbol (supported by the exchange)
         * - add all the main channels to the channel repository
         */
        let allSymbolsString = '';
        for(let iSymbol = 0; iSymbol < this._data.symbols.length; iSymbol++) {
            const symbol = this._data.symbols[iSymbol];

            const exchangeSymbol = getTickerSymbol(this._exchange, symbol);

            /**
             * Klines channels
             */
            this._channelManager.addChannel(new KlineChannel('kline' + exchangeSymbol, {
                topic: '/market/candles:' + exchangeSymbol + '_1min'
            }, this._mainSocket));

            /**
             * Compile list of symbols (separated by comma)
             */
            allSymbolsString += exchangeSymbol;
            if(iSymbol < this._data.symbols.length - 1) {
                allSymbolsString += ',';
            }
        }

        /**
         * Level 2 depth chart / orderbook
         */
        this._channelManager.addChannel(new OrderBookChannel('level2OrderBook', {
            topic: '/spotMarket/level2Depth50:' + allSymbolsString
        }, this._mainSocket));

        /**
         * Level 3 match execution data
         */
         this._channelManager.addChannel(new MatchExecutionChannel('level3MatchData', {
            topic: '/market/match:' + allSymbolsString
        }, this._mainSocket));

        /**
         * Subscribe to all symbol ticker
         */
        this._channelManager.addChannel(new TickerChannel('allTicker', {
            topic: '/market/ticker:all'
        }, this._mainSocket));

        /**
         * Setup events for channel manager
         * - on channel connect
         * - on channel disconnect
         * - on channel error
         * - on channel message
         */
        this._channelManager.onConnect(({channel, message}) => {
            console.log('System: channel ' + channel.getName() + '(' + channel.getId() + ') connected');
        });
        this._channelManager.onError(({channel, error}) => {
            console.log('System: channel ' + channel.getName() + '(' + channel.getId() + ') error:', error);
        });
        this._channelManager.onDisconnect(({channel, message}) => {
            console.log('System: channel ' + channel.getName() + '(' + channel.getId() + ') disconnected');
        });
        this._channelManager.onMessage(({channel, message}) => {
            if(channel.getName() === 'allTicker') {
                context._eventBus.emit('onTickerUpdate', {
                    exchangeName: context._exchange.name, 
                    symbol: message.subject,
                    data: message.data
                });
            }
            else if(channel.getName().indexOf('kline') !== -1) {
                context._eventBus.emit('onKlineUpdate', {
                    exchangeName: context._exchange.name,
                    interval: '1m',
                    symbol: message.data.symbol,
                    data: {
                        startTimestamp: message.data.candles[0],
                        open: message.data.candles[1],
                        close: message.data.candles[2],
                        high: message.data.candles[3],
                        low: message.data.candles[4],
                        volume: message.data.candles[5],
                        total: message.data.candles[6],
                        timestamp: Math.trunc(message.data.time / 1000000) // convert from nanoseconds to ms
                    }
                });
            }
            else if(channel.getName() === 'level2OrderBook') {
                const symbol = message.topic.split(':')[1];
                context._eventBus.emit('onOrderBookUpdate', {
                    exchangeName: context._exchange.name,
                    symbol: symbol,
                    data: message.data
                });
            }
            else if(channel.getName() === 'level3MatchData') {
                const symbol = message.topic.split(':')[1];
                context._eventBus.emit('onOrderUpdate', {
                    exchangeName: context._exchange.name,
                    symbol: symbol,
                    data: {
                        ...message.data,
                        timestamp: Math.trunc(parseInt(message.data.time) / 1000000) // convert nanoseconds to ms
                    }
                });
            }
        });

        /**
         * Connect all channels to the main socket connection
         */
        this._channelManager.connectChannels();

        /**
         * Loop through all exchange account for the given exchange
         * - get private connection token
         * - setup new private web socket connection
         * - setup new channel manager
         * - subscribe/connect to all needed channels
         */
        for(let iAccount in this._data.accounts) {
            const account = this._data.accounts[iAccount];

            const accountManager = new AccountManager(context._exchange, account);

            /**
             * When account websocket is connected
             */
            accountManager.onAccountConnect(({accountId}) => {
                console.log('System: connected to account (' + accountId + ')');
            });

            /**
             * When account websocket is disconnected
             */
            accountManager.onAccountDisconnect(({accountId}) => {
                console.log('System: disconnected from account (' + accountId + ')');
            });

            /**
             * When account channel is subscribed
             */
            accountManager.onConnect(({accountId, channel, message}) => {
                console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') connected');
            });

            /**
             * When account channel is unsubscribed
             */
            accountManager.onDisconnect(({accountId, channel, message}) => {
                console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') disconnected');
            });

            /**
             * When account channel error
             */
            accountManager.onError(({accountId, channel, error}) => {
                console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') error:', error);
            });

            /**
             * When account channel message
             */
            accountManager.onMessage(({accountId, channel, message}) => {
                if(channel.getName().indexOf('accountOrder') !== -1) {
                    context._eventBus.emit('onAccountTradeUpdate', {
                        exchangeName: context._exchange.name,
                        accountId,
                        data: {
                            ...message.data,
                            timestamp: Math.trunc(message.data.ts / 1000000) // convert nanoseconds to ms
                        }
                    });
                }
                else if(channel.getName().indexOf('accountBalance') !== -1) {
                    context._eventBus.emit('onAccountBalanceUpdate', {
                        exchangeName: context._exchange.name,
                        accountId,
                        data: {
                            ...message.data,
                            timestamp: parseInt(message.data.time)
                        }
                    });
                }
            });

            /**
             * Connect to the account websocket connection and channels
             */
            accountManager.connect();

            this._accountManagers[account.id] = accountManager;
        }

        /**
         * Setup ping response timer for main socket connection
         */
        let pingTimer = null;
        let pingTimeoutTimer = null;
        const pingId = randomUUID();
        this._mainSocket.onMessage((message) => {
            if(message.type === 'welcome') {
                pingTimer = setInterval(() => {
                    try {
                        context._mainSocket.sendMessage({
                            id: pingId,
                            type: 'ping'
                        });
    
                        // if ping times out, disconnect and re-initialize client connection
                        pingTimeoutTimer = setTimeout(() => {
                            context.disconnect();
                            context.connect();

                            clearTimeout(pingTimer);
                            pingTimer = null;
                            clearTimeout(pingTimeoutTimer);
                            pingTimeoutTimer = null;
                        }, webSocketPingTimeout);
                    }
                    catch(ex) {
                        console.log('System: exchange disconnected on error:', ex);

                        clearInterval(pingTimer);
                        pingTimer = null;
                        clearTimeout(pingTimeoutTimer);
                        pingTimeoutTimer = null;

                        context.disconnect();
                        context.connect();
                    }

                    // console.log('System: exchange connection (' + context._exchange.name + ') ping: ' + pingId);
                }, webSocketPingInterval);
            }
            else if(message.type === 'pong' && message.id == pingId) {
                clearTimeout(pingTimeoutTimer);
                pingTimeoutTimer = null;

                // console.log('System: exchange connection (' + context._exchange.name + ') pong: ' + pingId);
            }
        });
    }

    /**
     * Update channel subscriptions without disconnecting
     */
    update(data: any)
    {
        let context = this;

        // this._data = data;

        const symbols = data.symbols;
        const accounts = data.accounts;

        /**
         * Loop through all the symbols for the exchange
         * - convert currency pair into exchange symbol (supported by the exchange)
         * - add all the main channels to the channel repository
         */
        let allSymbolsString = '';
        for(let iSymbol = 0; iSymbol < symbols.length; iSymbol++) {
            const symbol = symbols[iSymbol];

            const exchangeSymbol = getTickerSymbol(this._exchange, symbol);

            /**
             * Klines channels
             */
            const channel = this._channelManager.getChannel('kline' + exchangeSymbol);
            if(!channel) {
                this._channelManager.addChannel(new KlineChannel('kline' + exchangeSymbol, {
                    topic: '/market/candles:' + exchangeSymbol + '_1min'
                }, this._mainSocket));

                this._channelManager.connectChannels('kline' + exchangeSymbol);
            }

            /**
             * Compile list of symbols (separated by comma)
             */
            allSymbolsString += exchangeSymbol;
            if(iSymbol < symbols.length - 1) {
                allSymbolsString += ',';
            }
        }

        /**
         * Level 2 depth chart / orderbook
         */
        if(symbols.length !== this._data.symbols) {
            this._channelManager.removeChannel('level2OrderBook');

            this._channelManager.addChannel(new OrderBookChannel('level2OrderBook', {
                topic: '/spotMarket/level2Depth50:' + allSymbolsString
            }, this._mainSocket));

            this._channelManager.connectChannels('level2OrderBook');
        }

        /**
         * Level 3 match execution data
         */
         if(symbols.length !== this._data.symbols) {
            this._channelManager.removeChannel('level3MatchData');

            this._channelManager.addChannel(new OrderBookChannel('level3MatchData', {
                topic: '/market/match:' + allSymbolsString
            }, this._mainSocket));

            this._channelManager.connectChannels('level3MatchData');
        }


        /**
         * Loop through all exchange account for the given exchange
         * - get private connection token
         * - setup new private web socket connection
         * - setup new channel manager
         * - subscribe/connect to all needed channels
         */
         for(let iAccount in accounts) {
            const account = accounts[iAccount];

            if(typeof this._accountManagers[account.id] === 'undefined') {

                const accountManager = new AccountManager(context._exchange, account);

                /**
                 * When account websocket is connected
                 */
                accountManager.onAccountConnect(({accountId}) => {
                    console.log('System: connected to account (' + accountId + ')');
                });

                /**
                 * When account websocket is disconnected
                 */
                accountManager.onAccountDisconnect(({accountId}) => {
                    console.log('System: disconnected from account (' + accountId + ')');
                });

                /**
                 * When account channel is subscribed
                 */
                accountManager.onConnect(({accountId, channel, message}) => {
                    console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') connected');
                });

                /**
                 * When account channel is unsubscribed
                 */
                accountManager.onDisconnect(({accountId, channel, message}) => {
                    console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') disconnected');
                });

                /**
                 * When account channel error
                 */
                accountManager.onError(({accountId, channel, error}) => {
                    console.log('System: account (' + accountId + ') channel ' + channel.getName() + ' (' + channel.getId() + ') error:', error);
                });

                /**
                 * When account channel message
                 */
                accountManager.onMessage(({accountId, channel, message}) => {
                    if(channel.getName().indexOf('accountOrder') !== -1) {
                        context._eventBus.emit('onAccountTradeUpdate', {
                            exchangeName: context._exchange.name,
                            accountId,
                            data: message.data
                        });
                    }
                    else if(channel.getName().indexOf('accountBalance') !== -1) {
                        context._eventBus.emit('onAccountBalanceUpdate', {
                            exchangeName: context._exchange.name,
                            accountId,
                            data: message.data
                        });
                    }
                });

                /**
                 * Connect to the account websocket connection and channels
                 */
                accountManager.connect();

                this._accountManagers[account.id] = accountManager;
            }
            else {
                /**
                 * Account manager already exists just re-connect
                 */
                this._accountManagers[account.id].connect();
            }
        }

        this._data = data;
    }

    /**
     * Is connected
     */
    isConnected()
    {
        return this._isConnected;
    }

    /**
     * Disconnect main socket connection and all account manager connections
     */
    disconnect()
    {
        console.log('exchange connection closed by client');

        for(let iAccount in this._accountManagers) {
            this._accountManagers[iAccount].disconnect();
        }

        this._mainSocket.disconnect();
    }
}