
import RestAPI from './utilities/RestAPI';
import HttpServer from './servers/HTTP';
import TCPServer from './servers/TCP';
import WebSocketServer from './servers/WebSocket';
import ExchangeCommunicator from './clients/exchange/ExchangeCommunicator';
import {InfluxDB, Point, HttpError} from '@influxdata/influxdb-client';

/**
 * System class that controls everything
 */

export default class System
{
    restAPI: RestAPI;
    httpServer: HttpServer;
    tcpServer: TCPServer;
    webSocketServer: WebSocketServer;
    exchangeCommunicator: ExchangeCommunicator;
    influxWrite: any;

    constructor()
    {
        // load configurations
        const restAPIURL = process.env.REST_API_URL ? process.env.REST_API_URL : 'http://localhost:9000/api';
        const httpPort = process.env.HTTP_PORT ? process.env.HTTP_PORT : '8889';
        const tcpPort = process.env.TCP_PORT ? process.env.TCP_PORT : '8888';
        const tcpHost = process.env.TCP_HOST ? process.env.TCP_HOST : 'localhost';

        // create REST API instance
        this.restAPI = new RestAPI(restAPIURL);

        // create HTTP server instance
        this.httpServer = new HttpServer({
            port: httpPort
        });

        // create TCP server instance
        this.tcpServer = new TCPServer({
            port: tcpPort,
            host: tcpHost
        });

        // create WebSocket server instance
        this.webSocketServer = new WebSocketServer({
            httpServer: this.httpServer.getServer()
        });

        // create exchange communicator instance
        this.exchangeCommunicator = new ExchangeCommunicator();

        // create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
        this.influxWrite = new InfluxDB({url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN}).getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 'ns')
    }

    /**
     * Start the system
     * 
     * - get all initialization data from rest API
     * - start TCP server
     * - start WebSocket server
     * - start client connections to all exchanges
     */
    async start(): Promise<void>
    {
        // get all supported exchanges from api
        const exchanges = await this.restAPI.getExchanges();

        // get all watched symbols from api for all supported exchanges
        const symbols = await this.restAPI.getTickerSymbols();

        // get all exchange accounts (connected exchanges)
        const accounts = await this.restAPI.getExchangeAccounts();

        /**
         * Http Server setup
         */
        // update clients (web and mobile, web socket) with trade statuses (from REST API)
        // update trading workers (tcp socket) when new bot session or conditional trade is added or updated (from REST API)
        // update trading workers (tcp socket) when a new algorithm (bot or conditional trade) is added or updated (from REST API)
        this.httpServer.start();

        /**
         * TCP Server setup
         */
        this.tcpServer.onConnect(socket => {
            console.log('new tcp client connected!');
        });
        
        this.tcpServer.onDisconnect(socket => {
            console.log('tcp client disconnected');
        });
        
        this.tcpServer.onError((socket, err) => {
            console.log('tcp client error:', err);
        });
        
        this.tcpServer.onMessage((socket, message) => {
            console.log('tcp client', message);
            // update socket server with trade statuses (from trader)
        });
        
        // start a tcp server for communication with trading workers
        this.tcpServer.start();


        /**
         * Web Socket Server setup
         */
        this.webSocketServer.onConnect(() => {
            console.log('new web socket client connected!');
        });

        this.webSocketServer.onDisconnect(socket => {
            console.log('web socket client disconnected')
        });

        this.webSocketServer.onError((socket, err) => {
            console.log('web socket client error:', err);
        });

        this.webSocketServer.onMessage((socket, message) => {
            console.log('web socket client', message);
            
        });

        // start a websocket server for communication with web clients and mobile app clients (socket.io)
        this.webSocketServer.start();


        /**
         * Exchange communication setup
         */
        this.exchangeCommunicator.onTickerUpdate((exchange, symbol, data) => {
            // store in time series database
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

            console.log(exchange, symbol);

            // notify web and mobile clients (web socket)
        });

        this.exchangeCommunicator.onKlineUpdate((exchange, interval, symbol, data) => {
            // notify web and mobile clients (web socket)
        });

        this.exchangeCommunicator.onOrderBookUpdate((exchange, symbol, data) => {
            // notify web and mobile clients (web socket)
        });

        this.exchangeCommunicator.onOrderUpdate((exchange, symbol, data) => {
            // notify web and mobile clients (web socket)
        });

        this.exchangeCommunicator.onAccountTradeUpdate((exchange, account, symbol, data) => {
            // notify specific web and mobile clients (web socket)
        });

        this.exchangeCommunicator.onAccountBalanceUpdate((exchange, account, symbol, data) => {
            // notify specific web and mobile clients (web socket)
        });

        this.exchangeCommunicator.start({
            exchanges,
            symbols,
            accounts
        });
    }

    /**
     * Stop the system
     * 
     * - stop TCP server
     * - stop WebSocket server
     */
    stop(): void
    {
        this.tcpServer.stop();
        this.webSocketServer.stop();
        this.exchangeCommunicator.stop();
    }
}