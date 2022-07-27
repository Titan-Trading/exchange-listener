
import RestAPI from './utilities/RestAPI';
import ExchangeCommunicator from './clients/exchange/ExchangeCommunicator';
import {InfluxDB, Point, HttpError} from '@influxdata/influxdb-client';
import Exchanges from './repositories/Exchanges';
import ExchangeAccounts from './repositories/ExchangeAccounts';
import Symbols from './repositories/Symbols';
import MessageBus from './MessageBus';
import { randomUUID } from 'crypto';

/**
 * System class that controls everything
 */

export default class System
{
    messageBus: MessageBus;
    restAPI: RestAPI;
    exchangeCommunicator: ExchangeCommunicator;
    influxWrite: any;

    logData: string|boolean;

    exchanges: Exchanges;
    exchangeAccounts: ExchangeAccounts;
    symbols: Symbols;

    constructor()
    {
        // load configurations
        const restAPIURL = process.env.REST_API_URL ? process.env.REST_API_URL : 'http://localhost:9000/api';
        const restAPIKey = process.env.REST_API_KEY ? process.env.REST_API_KEY : '';
        const restAPIKeySecret = process.env.REST_API_KEY_SECRET ? process.env.REST_API_KEY_SECRET : '';
        this.logData = process.env.LOG_DATA ? process.env.LOG_DATA : false; 

        // create message bus instance
        this.messageBus = new MessageBus(process.env.CLIENT_ID, process.env.GROUP_ID, [process.env.KAFKA_BOOTSTRAP_SERVER]);

        // create REST API instance
        this.restAPI = new RestAPI(restAPIURL, restAPIKey, restAPIKeySecret);

        // create exchange communicator instance
        this.exchangeCommunicator = new ExchangeCommunicator();

        // create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
        this.influxWrite = new InfluxDB({
            url:   process.env.INFLUX_URL,
            token: process.env.INFLUX_TOKEN
        }).getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 'ns');
        
        // create repository instances
        this.exchanges = Exchanges.getInstance();
        this.exchangeAccounts = ExchangeAccounts.getInstance();
        this.symbols = Symbols.getInstance();
    }

    /**
     * Start the system
     * 
     * - get all initialization data from rest API
     * - start connection to message bus
     * - start client connections to all exchanges
     */
    async start(): Promise<void>
    {
        const context = this;
        
        /**
         * Load initial data
         */
        await this.loadData();

        /**
         * Setup message bus
         * - listen for changes with exchanges, exchange accounts and exchange symbols and update exchange communicator
         */
        this.messageBus.onMessage('exchanges', async (message) => {
            console.log('exchange update', message);
            await this.loadData();
        });

        this.messageBus.onMessage('exchange-accounts', async (message) => {
            console.log('exchange account update', message);
            await this.loadData();
        });

        await this.messageBus.connect().then(async () => {
            console.log('connected to message bus');
        
            // let the service registry know that a new micro-service is online
            await this.messageBus.sendEvent('service-registry', 'SERVICE_ONLINE', {
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
         * Exchange communication setup
         * - add outbound messages for socket gateway (message bus)
         * - add market data updates for backtester and trade worker (message bus)
         */
        this.exchangeCommunicator.onTickerUpdate((exchange, symbol, data) => {
            // store in time series database
            if(context.logData) {
                const point = new Point('ticker_data')
                .tag('exchange', exchange)
                .tag('symbol', symbol)
                .tag('interval', '1s')
                .floatField('bestAsk', parseFloat(data.bestAsk))
                .floatField('bestAskVolume', parseFloat(data.bestAskSize))
                .floatField('bestBid', parseFloat(data.bestBid))
                .floatField('bestBidVolume', parseFloat(data.bestBidSize))
                .floatField('volume', parseFloat(data.size))
                .timestamp(new Date(data.time));
            
                this.influxWrite.writePoint(point);
            }

            // console.log(exchange, symbol);

            // notify web and mobile clients (web socket)
        });

        /**
         * Kline/candlestick data updates
         */
        this.exchangeCommunicator.onKlineUpdate((exchange, interval, symbol, data) => {
            // store in time series database
            if(context.logData) {
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
            
                this.influxWrite.writePoint(point);
            }

            console.log(exchange, interval, symbol);

            // put exchange market data update onto the message bus
            context.messageBus.sendEvent('klines', 'MARKET_DATA_UPDATE', {
                serviceId:  process.env.SERVICE_ID,
                instanceId: process.env.INSTANCE_ID,
                exchange,
                symbol,
                data
            });

            // put outbound socket-gateway messages onto the message bus
            /*context.messageBus.sendEvent('socket-gateway', 'exchanges/' + exchange + '/KLINE_UPDATE', {

            });*/
        });

        /**
         * Best 50 depth levels from order book
         */
        this.exchangeCommunicator.onOrderBookUpdate((exchange, symbol, data) => {
            // notify web and mobile clients (web socket)
            console.log(exchange, symbol, data);
        });

        /**
         * Individual level 3 depth data from order book
         */
        /*this.exchangeCommunicator.onOrderUpdate((exchange, symbol, data) => {
            // notify web and mobile clients (web socket)
        });*/

        /**
         * Order updates for an exchange account
         */
        this.exchangeCommunicator.onAccountTradeUpdate((exchange, account, symbol, data) => {
            // notify specific web and mobile clients (web socket)
        });

        /**
         * Account updates for an exchange account
         */
        this.exchangeCommunicator.onAccountBalanceUpdate((exchange, account, symbol, data) => {
            // notify specific web and mobile clients (web socket)
        });

        this.exchangeCommunicator.start({
            exchanges: this.exchanges,
            symbols:   this.symbols,
            accounts:  this.exchangeAccounts
        });
    }

    /**
     * Load data from the api and updating the exchange communicator
     */
    async loadData()
    {
        console.log('Loading data from api...');

        const exchanges = await this.restAPI.getExchanges(); // get all supported exchanges from api
        const symbols   = await this.restAPI.getTickerSymbols(); // get all watched symbols from api for all supported exchanges
        const accounts  = await this.restAPI.getExchangeAccounts(); // get all exchange accounts (connected exchanges) from api
  
        console.log('Exchanges loaded ' + exchanges);
        console.log('Exchange symbols loaded ', symbols);
        console.log('Exchange accounts loaded ', accounts);

        // set initial data into repositories
        this.exchanges.set(exchanges);
        this.exchangeAccounts.set(accounts);
        this.symbols.set(symbols);

        // update the exchange communicator with the newest data
        this.exchangeCommunicator.update({
            exchanges: this.exchanges,
            symbols:   this.symbols,
            accounts:  this.exchangeAccounts
        });
    }

    /**
     * Stop the system
     *
     * - stop exchange communicator
     */
    async stop()
    {
        // let the service registry know that a micro-service is offline
        await this.messageBus.sendEvent('service-registry', 'SERVICE_OFFLINE', {
            instanceId: process.env.INSTANCE_ID,
            serviceId:  process.env.SERVICE_ID
        });

        await this.exchangeCommunicator.stop();

        await this.messageBus.disconnect();
    }
}