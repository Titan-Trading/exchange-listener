
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
    start(settings: {exchanges: Array<any>, symbols: Array<any>, accounts: Array<any>}): void
    {
        this._exchangeAPIs = {};
        this._exchangeSockets = {};

        const context = this;

        // loop through each exchange
        settings.exchanges.map(async exchange => {
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

                    const allSymbolTickerId = randomUUID();
                    const pingId = randomUUID();
                    let pingTimer = null;

                    socket.onMessage((data) => {

                        // once welcome message is received subscribe to different topics/channels
                        if(data.type === 'welcome') {
                            // subscribe to all symbol ticker
                            socket.sendMessage({
                                id: allSymbolTickerId,                          
                                type: 'subscribe',
                                topic: '/market/ticker:all',
                                response: true                             
                            });
                            console.log('Subscribe: ' + allSymbolTickerId);

                            // setup ping timer
                            setInterval(() => {
                                socket.sendMessage({
                                    id: pingId,                          
                                    type: 'ping'                        
                                });
                            }, webSocketPingInterval);
                            console.log('Ping: ' + pingId);
                        }
                        // acknowledge ping
                        else if(data.type === 'pong') {
                            console.log('Pong: ' + pingId);
                        }
                        // acknowledge that a topic/channel was subscribed to
                        else if(data.type === 'ack') {
                            console.log('Acknowledge: ' + allSymbolTickerId);
                        }
                        // channel message
                        else if(data.type === 'message') {
                            // ticker data (all symbols)
                            if(data.topic === '/market/ticker:all') {
                                if(typeof context._onTickerUpdate === 'function') {
                                    context._onTickerUpdate(exchange.name, data.subject, data.data);
                                }
                            }
                        }

                    });
                break;
            }
        });
            // create a websocket client for each exchange
            // subscribe to different channels based on each symbol
            // subscribe to different channels based on each exchange account
    }

    /**
     * Stop exchange connections
     */
    stop(): void
    {
 
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