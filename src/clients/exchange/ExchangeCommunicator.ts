
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

import { randomUUID } from "crypto";
import ExchangeAccounts from "../../repositories/ExchangeAccounts";
import Exchanges from "../../repositories/Exchanges";
import Symbols from "../../repositories/Symbols";
import WebSocketClient from "../../utilities/WebSocketClient";
import KuCoinRestAPI from "./exchanges/KuCoin/RestAPI";

export default class ExchangeCommunicator
{
    _onTickerUpdate: (exchange: string, symbol: string, data: any) => void;
    _onKlineUpdate: (exchange: string, interval: string, symbol: string, data: any) => void;
    _onOrderBookUpdate: (exchange: string, symbol: string, data: any) => void;
    _onOrderUpdate: (exchange: string, symbol: string, data: any) => void;
    _onAccountTradeUpdate: (exchange: string, accountId: string, symbol: string, data: any) => void;
    _onAccountBalanceUpdate: (exchange: string, accountId: string, symbol: string, data: any) => void;
    _onError: (err) => void;
    _exchangeAPIs: any;
    _exchangeSockets: any;

    constructor()
    {
        
    }

    /**
     * Start exchange connections
     */
    start(repos: {exchanges: Exchanges, symbols: Symbols, accounts: ExchangeAccounts}): void
    {
        this._exchangeAPIs = {};
        this._exchangeSockets = {};

        const context = this;

        const symbols = repos.symbols.get();
        const accounts = repos.accounts.get();

        // loop through each exchange
        repos.exchanges.get().map(async exchange => {
            switch(exchange.name) {
                case 'KuCoin':
                    this._exchangeAPIs['KuCoin'] = new KuCoinRestAPI('https://api.kucoin.com');

                    const initData = await this._exchangeAPIs['KuCoin'].getInitialData();

                    const webSocketToken = initData.data.token;
                    const webSocketHost = initData.data.instanceServers[0].endpoint;
                    const webSocketPingInterval = initData.data.instanceServers[0].pingInterval;

                    this._exchangeSockets['KuCoin'] = new WebSocketClient({host: webSocketHost + '?token=' + webSocketToken});

                    const socket = this._exchangeSockets['KuCoin'];
                    socket.onConnect(() => {
                        console.log('Connected to KuCoin socket server!');
                    });

                    let channels = {};
                    let allSymbolsString = '';

                    // loop through all exchange accounts for the exchange
                    accounts.map((account, index) => {

                    });

                    // loop through all symbols for the exchange
                    symbols.map((symbol, index) => {
                        // klines
                        const symbolKlinesId = randomUUID();
                        channels[symbolKlinesId] = {
                            config: {
                                id: symbolKlinesId,
                                type: 'subscribe',
                                topic: '/market/candles:' + symbol.target_currency.name + '-' + symbol.base_currency.name + '_1min',
                                response: true
                            },
                            symbol
                        };

                        // compile list of symbols (separated by comma)
                        allSymbolsString += symbol.target_currency.name + '-' + symbol.base_currency.name;
                        if(index < symbols.length - 1) {
                            allSymbolsString += ',';
                        }
                    });

                    // level 2 depth chart
                    const level2DepthId = randomUUID();
                    channels[level2DepthId] = {
                        config: {
                            id: level2DepthId,
                            type: 'subscribe',
                            topic: '/spotMarket/level2Depth50:' + allSymbolsString
                        }
                    };

                    const pingId = randomUUID();
                    let pingTimer = null;

                    socket.onMessage((data) => {

                        // once welcome message is received subscribe to different topics/channels
                        if(data.type === 'welcome') {
                            // subscribe to all symbol ticker
                            // socket.sendMessage({
                            //     id: allSymbolTickerId,                          
                            //     type: 'subscribe',
                            //     topic: '/market/ticker:all',
                            //     response: true                             
                            // });
                            // console.log('Subscribe: ' + allSymbolTickerId);

                            // subscribe to all symbol channels
                            // subscribe to candle/kline
                            for(let channelId in channels) {
                                const symbol = channels[channelId].symbol;
                                if(typeof channels[channelId].symbol !== 'undefined') {
                                    console.log('Subscribe channel: ' + symbol.target_currency.name + '-' + symbol.base_currency.name);
                                }
                                else {
                                    console.log('Subscribe channel: ' + channelId);
                                }

                                socket.sendMessage(channels[channelId].config);
                            }

                            // setup ping timer
                            setInterval(() => {
                                socket.sendMessage({
                                    id: pingId,                          
                                    type: 'ping'                        
                                });

                                // console.log('Ping: ' + pingId);
                            }, webSocketPingInterval);
                        }
                        // acknowledge ping
                        else if(data.type === 'pong') {
                            // console.log('Pong: ' + pingId);
                        }
                        // acknowledge that a topic/channel was subscribed to
                        else if(data.type === 'ack') {
                            if(typeof channels[data.id] !== 'undefined') {
                                if(typeof channels[data.id].symbol !== 'undefined') {
                                    const symbol = channels[data.id].symbol;
                                    console.log('Acknowledge channel: ' + symbol.target_currency.name + '-' + symbol.base_currency.name);
                                }
                                else {
                                    console.log('Acknowledge channel: ' + data.id);
                                }
                            }
                        }
                        // channel message
                        else if(data.type === 'message') {
                            // ticker data (all symbols)
                            if(data.topic === '/market/ticker:all') {
                                if(typeof context._onTickerUpdate === 'function') {
                                    context._onTickerUpdate(exchange.name, data.subject, data.data);
                                }
                            }
                            else if(data.subject && data.subject === 'trade.candles.update') {
                                if(typeof context._onKlineUpdate === 'function') {
                                    context._onKlineUpdate(exchange.name, '1m', data.data.symbol, {
                                        startTimestamp: data.data.candles[0],
                                        open: data.data.candles[1],
                                        close: data.data.candles[2],
                                        high: data.data.candles[3],
                                        low: data.data.candles[4],
                                        volume: data.data.candles[5],
                                        total: data.data.candles[6],
                                        timestamp: Math.trunc(data.data.time / 1000000)
                                    });
                                }
                            }
                            else if(data.subject && data.subject === 'level2') {
                                if(typeof context._onOrderBookUpdate === 'function') {
                                    const symbol = data.topic.split(':')[1];
                                    context._onOrderBookUpdate(exchange.name, symbol, data.data);
                                }
                            }
                        }

                    });
                break;
            }
        });
    }

    /**
     * Update exchange connections
     */
    update(repos: {exchanges: Exchanges, symbols: Symbols, accounts: ExchangeAccounts}): void
    {
        const context = this;

        // stop the connections
        this.stop();

        // start the connections back up with new data
        this.start(repos);
    }

    /**
     * Stop exchange connections
     */
    stop(): void
    {
        // loop through each exchange and close the connection
        for(let eSI in this._exchangeSockets) {
            this._exchangeSockets[eSI].disconnect();
        }
        
        this._exchangeAPIs = {};
        this._exchangeSockets = {};
    }

    /**
     * When a market ticker event update is received
     * 
     * @param callback 
     */
    onTickerUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._onTickerUpdate = callback;
    }

    /**
     * When a chart data/kline event update is received
     * 
     * @param callback 
     */
    onKlineUpdate(callback: (exchange: string, interval: string, symbol: string, data: any) => void): void
    {
        this._onKlineUpdate = callback;
    }

    /**
     * When a level 2 orderbook update is received (price levels)
     * 
     * @param callback 
     */
    onOrderBookUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._onOrderBookUpdate = callback;
    }

    /**
     * When a level 3 orderbook update is received (individual matches/orders)
     * 
     * @param callback 
     */
    onOrderUpdate(callback: (exchange: string, symbol: string, data: any) => void): void
    {
        this._onOrderUpdate = callback;
    }

    /**
     * When a order update for an account is received
     * 
     * @param callback 
     */
    onAccountTradeUpdate(callback: (exchange: string, accountId: string, symbol: string, data: any) => void): void
    {
        this._onAccountTradeUpdate = callback;
    }

    /**
     * When a balance update for an account is received (deposit, withdraw, hold and margin)
     * 
     * @param callback 
     */
    onAccountBalanceUpdate(callback: (exchange: string, accountId: string, symbol: string, data: any) => void): void
    {
        this._onAccountBalanceUpdate = callback;
    }
}