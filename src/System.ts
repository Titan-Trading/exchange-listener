
import RestAPI from './utilities/RestAPI';
import ExchangeCommunicator from './clients/exchange/ExchangeCommunicator';
import {InfluxDB, Point, HttpError} from '@influxdata/influxdb-client';
import Exchanges from './repositories/Exchanges';
import MessageBus from './utilities/MessageBus';
import SocketIOClient from './utilities/SocketIOClient';


/**
 * System class that controls everything
 */

export default class System
{
    messageBus: MessageBus;
    restAPI: RestAPI;
    apiConnectToken: string;
    socketServer: SocketIOClient;
    exchangeCommunicator: ExchangeCommunicator;
    influxWrite: any;

    logData: string|boolean;

    exchanges: Exchanges;

    constructor()
    {
        // load configurations
        const restAPIURL = process.env.REST_API_URL ? process.env.REST_API_URL : 'http://localhost:9000';
        const restAPIKey = process.env.REST_API_KEY ? process.env.REST_API_KEY : '';
        const restAPIKeySecret = process.env.REST_API_KEY_SECRET ? process.env.REST_API_KEY_SECRET : '';
        const socketServerURL = process.env.WEBSOCKET_SERVER_URL ? process.env.WEBSOCKET_SERVER_URL : '';
        const logExchangeData = process.env.LOG_EXCHANGE_DATA ? process.env.LOG_EXCHANGE_DATA : 'false';

        this.logData = logExchangeData;

        // create message bus instance
        this.messageBus = new MessageBus(process.env.CLIENT_ID, process.env.GROUP_ID, [process.env.KAFKA_BOOTSTRAP_SERVER]);

        // create websocket client instance
        this.socketServer = new SocketIOClient({host: socketServerURL});

        // create REST API instance
        this.restAPI = new RestAPI(restAPIURL, restAPIKey, restAPIKeySecret);

        // create exchange communicator instance
        this.exchangeCommunicator = new ExchangeCommunicator(this.restAPI);

        // create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
        if(this.logData !== 'false') {
            const influxDB = new InfluxDB({
                url:   process.env.INFLUX_URL,
                token: process.env.INFLUX_TOKEN
            });

            this.influxWrite = influxDB.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 'ns');
        }
        
        // create repository instances
        this.exchanges = Exchanges.getInstance();
    }

    /**
     * Start the system
     * 
     * - get all initialization data from rest API
     * - start connection to message bus
     * - start client connections to all exchanges
     */
    async start(): Promise<boolean>
    {
        const context = this;

        console.log('System: starting...');

        return new Promise(async (resolve, reject) => {
            try {
                /**
                 * Load initial data
                 * - update exchange communicator
                 * - get api connect token
                 */
                context.loadData().then(() => {
                    /**
                     * Connect to the socket gateway
                     */
                    if(process.env.SOCKET_GATEWAY !== 'false') {
                        console.log('System: connecting to socket gateway...');
                        context.socketServer.connect(this.apiConnectToken);
                    }
                });

                /**
                 * When connected to socket gateway server
                 */
                context.socketServer.onConnect(async () => {
                    console.log('System: connected to socket gateway');
                });

                /**
                 * When disconnected from socket gateway server
                 */
                context.socketServer.onDisconnect(async (reason) => {
                    console.log('System: disconnected from socket gateway', reason);
                });

                /**
                 * When error from socket gateway server
                 */
                 context.socketServer.onError(async (error) => {
                    console.log('System: error from socket gateway', error);
                });

                /**
                 * Exchange communication setup
                 * - add outbound messages for socket gateway (socket gateway server)
                 * - add market data updates for backtester and trade worker (socket gateway server)
                 */
                context.exchangeCommunicator.onTickerUpdate((exchange, symbol, data) => {
                    // store in time series database (too much data)
                    /*if(context.logData !== 'false') {
                        const point = new Point('ticker_data')
                        .tag('exchange', exchange)
                        .tag('symbol', symbol)
                        .tag('interval', '2s')
                        .floatField('bestAsk', parseFloat(data.bestAsk))
                        .floatField('bestAskVolume', parseFloat(data.bestAskSize))
                        .floatField('bestBid', parseFloat(data.bestBid))
                        .floatField('bestBidVolume', parseFloat(data.bestBidSize))
                        .floatField('volume', parseFloat(data.size))
                        .timestamp(''); // set server assign timestamp automatically
                    
                        context.influxWrite.writePoint(point);
                    }*/

                    // console.log(exchange, symbol, data);

                    // notify web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_DATA',
                            type: 'TICKER_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            symbol,
                            data
                        }
                    });
                });

                /**
                 * Kline/candlestick data updates
                 */
                context.exchangeCommunicator.onKlineUpdate((exchange, interval, symbol, data) => {
                    // store in time series database (once a second)
                    if(context.logData !== 'false') {
                        const point = new Point('klines')
                        .tag('exchange', exchange)
                        .tag('symbol', symbol)
                        .tag('interval', interval)
                        .intField('startTimestamp', parseInt(data.startTimestamp))
                        .floatField('open', parseFloat(data.open))
                        .floatField('close', parseFloat(data.close))
                        .floatField('high', parseFloat(data.high))
                        .floatField('low', parseFloat(data.low))
                        .floatField('volume', parseFloat(data.volume))
                        .floatField('total', parseFloat(data.total))
                        .timestamp(new Date(data.timestamp));
                    
                        context.influxWrite.writePoint(point);
                    }

                    // notify web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_DATA',
                            type: 'KLINE_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            symbol,
                            candle: data
                        }
                    });

                    // console.log(exchange, interval, symbol, data);
                });

                /**
                 * Best 50 depth levels from order book
                 */
                context.exchangeCommunicator.onOrderBookUpdate((exchange, symbol, data) => {
                    // store in time series database
                    if(context.logData !== 'false') {
                        /*const point = new Point('orderbook_data')
                        .tag('exchange', exchange)
                        .tag('symbol', symbol)
                        .tag('interval', '100ms')
                        .floatField('bestAsk', parseFloat(data.bestAsk))
                        .floatField('bestAskVolume', parseFloat(data.bestAskSize))
                        .floatField('bestBid', parseFloat(data.bestBid))
                        .floatField('bestBidVolume', parseFloat(data.bestBidSize))
                        .floatField('volume', parseFloat(data.size))
                        .timestamp(new Date(data.timestamp));
                    
                        context.influxWrite.writePoint(point);*/
                    }

                    // notify web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_DATA',
                            type: 'ORDERBOOK_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            symbol,
                            data
                        }
                    });

                    // console.log(exchange, symbol, data);
                });

                /**
                 * Individual level 3 depth data from order book (match execution)
                 */
                context.exchangeCommunicator.onOrderUpdate((exchange, symbol, data) => {
                    // store in time series database (too much data)
                    /*if(context.logData !== 'false') {
                        const point = new Point('order_data')
                        .tag('exchange', exchange)
                        .tag('symbol', symbol)
                        .tag('type', data.type)
                        .tag('side', data.side)
                        .tag('sequence', data.sequence)
                        .tag('tradeId', data.tradeId)
                        .tag('takerOrderId', data.takerOrderId)
                        .tag('markerOrderId', data.makerOrderId)
                        .floatField('price', parseFloat(data.price))
                        .floatField('size', parseFloat(data.size))
                        .timestamp(new Date(data.timestamp));
                    
                        context.influxWrite.writePoint(point);
                    }*/

                    // notify web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_DATA',
                            type: 'ORDER_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            symbol,
                            data
                        }
                    });

                    // console.log(exchange, symbol, data);
                });

                /**
                 * Order updates for an exchange account
                 */
                context.exchangeCommunicator.onAccountTradeUpdate((exchange, accountId, data) => {
                    // store in time series database
                    if(context.logData !== 'false') {
                        const point = new Point('account_trade_data')
                        .tag('exchange', exchange)
                        .tag('accountId', accountId)
                        .tag('symbol', data.symbol)
                        .tag('side', data.side)
                        .tag('type', data.type)
                        .tag('orderType', data.orderType)
                        .tag('status', data.status)
                        .tag('orderTime', (data.orderTime).toString())
                        .intField('orderId', parseInt(data.orderId))
                        .floatField('size', parseFloat(data.size))
                        .floatField('filledSize', parseFloat(data.filledSize))
                        .floatField('remainSize', parseFloat(data.remainSize))
                        .floatField('price', parseFloat(data.price))
                        .timestamp(new Date(data.timestamp));
                    
                        context.influxWrite.writePoint(point);
                    }

                    // notify specific web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_ACCOUNT_DATA',
                            type: 'TRADE_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            accountId,
                            data
                        }
                    });

                    // console.log(exchange, accountId, data);
                });

                /**
                 * Account updates for an exchange account
                 */
                context.exchangeCommunicator.onAccountBalanceUpdate((exchange, accountId, data) => {
                    // store in time series database
                    if(context.logData !== 'false') {
                        const point = new Point('account_balance_data')
                        .tag('exchange', exchange)
                        .tag('accountId', accountId)
                        .tag('currency', data.currency)
                        .tag('relationEvent', data.side)
                        .floatField('total', parseFloat(data.total))
                        .floatField('available', parseFloat(data.available))
                        .floatField('availableChange', parseFloat(data.availableChange))
                        .floatField('hold', parseFloat(data.hold))
                        .floatField('holdChange', parseFloat(data.holdChange))
                        .timestamp(new Date(data.timestamp));
                    
                        context.influxWrite.writePoint(point);
                    }

                    // notify specific web and mobile clients (web socket)
                    context.socketServer.sendMessage({
                        meta: {
                            category: 'EXCHANGE_ACCOUNT_DATA',
                            type: 'BALANCE_UPDATE',
                            exchange: exchange
                        },
                        data: {
                            accountId,
                            data
                        }
                    });

                    // console.log(exchange, accountId, data);
                });

                /**
                 * Start the exchange communicator
                 */
                if(process.env.EXCHANGE_LISTENER !== 'false') {
                    console.log('System: starting exchange communicator...');
                    context.exchangeCommunicator.connect().then(() => {
                        console.log('System: exchange communicator started');
                    });
                }

                /**
                 * When connected to message bus
                 * - register service with service registry
                 */
                context.messageBus.onConnect(async () => {
                    console.log('System: connected to message bus');
            
                    /**
                     * Register with the service registry
                     */
                    context.messageBus.sendEvent('service-registry', 'SERVICE_ONLINE', {
                        instanceId: process.env.INSTANCE_ID,
                        serviceId:  process.env.SERVICE_ID,
                        supportedCommunicationChannels: ['bus'],
                        hostname: 'exchange-listener',
                        port: 10000,
                        endpoints: [],
                        commands:  []
                    });
                });

                /**
                 * When changes are made to exchanges (on message bus)
                 */
                context.messageBus.onMessage('exchanges', async (message) => {
                    console.log('exchange update', message);
                    
                    // TODO: update exchanges without disconnecting exchange communicator
                    const exchanges = await this.restAPI.getExchanges();
                    
                    console.log('System: exchanges loaded ', exchanges.length);

                    // set initial data into repositories
                    this.exchanges.set(exchanges);

                    // update the exchange communicator with the newest data
                    this.exchangeCommunicator.update({
                        exchanges: this.exchanges
                    });
                });

                /**
                 * When changes are made to exchange accounts (on message bus)
                 */
                context.messageBus.onMessage('exchange-accounts', async (message) => {
                    console.log('exchange account update', message);
                    
                    // TODO: update exchange accounts without disconnecting exchange communicator
                    const exchanges = await this.restAPI.getExchanges();
                    
                    console.log('System: exchanges loaded ', exchanges.length);

                    // set initial data into repositories
                    this.exchanges.set(exchanges);

                    // update the exchange communicator with the newest data
                    this.exchangeCommunicator.update({
                        exchanges: this.exchanges
                    });
                });

                /**
                 * When changes are made to indicators (on message bus)
                 */
                context.messageBus.onMessage('indicators', async (message) => {
                    console.log('indicator update', message);
                    
                    // TODO: update indicators without disconnecting exchange communicator

                });


                /**
                 * Connect to message bus
                 */
                if(process.env.MESSAGE_BUS !== 'false') {
                    console.log('System: connecting to message bus...');
                    context.messageBus.connect();
                }

                resolve(true);
            }
            catch(err) {
                console.log('System error: ', err);
                resolve(false);
            }
        });
    }

    /**
     * Load data from the api and updating the exchange communicator
     */
    async loadData()
    {
        try {
            console.log('System: loading data from api...');

            const exchanges = await this.restAPI.getExchanges(); // get all supported exchanges from api
            this.apiConnectToken = await this.restAPI.getAPIConnectToken();

            console.log('System: API connect token loaded ', this.apiConnectToken);
            console.log('System: exchanges loaded: ', exchanges.length);

            // set initial data into repositories
            this.exchanges.set(exchanges);

            // update the exchange communicator with the newest data
            if(process.env.EXCHANGE_LISTENER !== 'false') {
                this.exchangeCommunicator.update({
                    exchanges: this.exchanges
                });
            }
        }
        catch(ex) {
            console.log('System error: ', ex);
        }
    }

    /**
     * Stop the system
     *
     * - let service registry know service is going offline
     * - stop exchange communicator
     * - disconnect from the message bus
     */
    async stop()
    {   
        try {
            if(process.env.MESSAGE_BUS !== 'false') {
                // let the service registry know that a micro-service is offline
                console.log('System: updating service registry (SERVICE_OFFLINE)...');
                await this.messageBus.sendEvent('service-registry', 'SERVICE_OFFLINE', {
                    instanceId: process.env.INSTANCE_ID,
                    serviceId:  process.env.SERVICE_ID
                });
                console.log('System: service registry updated');
            }

            if(process.env.EXCHANGE_LISTENER !== 'false') {
                console.log('System: disconnecting exchange communicator...');
                await this.exchangeCommunicator.disconnect();
                console.log('System: exchange communicator disconnected');
            }

            if(process.env.SOCKET_GATEWAY !== 'false') {
                console.log('System: disconnecting socket gateway...');
                await this.socketServer.disconnect();
                console.log('System: socket gateway disconnected');
            }

            if(process.env.MESSAGE_BUS !== 'false') {
                console.log('System: disconnecting from message bus...');
                await this.messageBus.disconnect();
                console.log('System: message bus disconnected');
            }
        }
        catch (ex) {
            console.log('System error: ', ex);
            return;
        }
    }
}