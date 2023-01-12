import WebSocketClient from "../../../../utilities/WebSocketClient";
import PubSub from "../../../../utilities/PubSub";
import ChannelManager from "./ChannelManager";
import KuCoinRestAPI from "./RestAPI";
import { randomUUID } from "crypto";
import AccountOrderChannel from "./channel_types/AccountOrderChannel";
import AccountBalanceChannel from "./channel_types/AccountBalanceChannel";


export default class AccountManager
{
    private _exchange: any;
    private _account: any;
    private _client: KuCoinRestAPI;
    private _socketClient: WebSocketClient;
    private _eventBus: PubSub;
    private _channelManager: ChannelManager;

    constructor(exchange: any, account: any)
    {
        this._exchange = exchange;
        this._account = account;

        this._eventBus = new PubSub();

        this._channelManager = new ChannelManager();
    }

    /**
     * Connect to exchange account channels
     * - get private socket connect id
     * - create new private socket connection
     * - connect to channels for account
     */
    async connect()
    {
        let context = this; 

        /**
         * Create REST API client
         */
        this._client = new KuCoinRestAPI('https://api.kucoin.com');

        /**
         * Get initial private data from exchange api for the account
         */
        const initData = await this._client.getPrivateInitialData({
            apiKey: this._account.api_key,
            apiKeySecret: this._account.api_key_secret,
            apiKeyPassphrase: this._account.api_key_passphrase,
            apiKeyVersion: this._account.api_version
        });

        // console.log(initData);

        if(!initData || initData.code !== '200000') {
            // console.log('Unable to get private connection details');
            return;
        }

        // console.log(initData);

        const webSocketToken = initData.data.token;
        const webSocketHost = initData.data.instanceServers[0].endpoint;
        const webSocketPingInterval = initData.data.instanceServers[0].pingInterval;
        const webSocketPingTimeout = initData.data.instanceServers[0].pingTimeout;

        /**
         * Connect to websocket api for exchange (main connection)
         */
        this._socketClient = new WebSocketClient({host: webSocketHost + '?token=' + webSocketToken});

        /**
         * When successfully connected to websocket api
         */
         this._socketClient.onConnect(() => {
            context._eventBus.emit('onAccountConnect', {accountId: context._account.id});
        });

        /**
         * When disconnected from websocket api
         */
        this._socketClient.onDisconnect(() => {
            context._eventBus.emit('onAccountDisconnect', {accountId: context._account.id});
        });

        /**
         * Subscribe to account order updates channel
         */
         this._channelManager.addChannel(new AccountOrderChannel('accountOrder' + context._account.id, {
            topic: '/spotMarket/tradeOrders'
        }, this._socketClient));

        /**
         * Subscribe to account balance updates channel
         */
        this._channelManager.addChannel(new AccountBalanceChannel('accountBalance' + context._account.id, {
            topic: '/account/balance'
        }, this._socketClient));

        /**
         * Connect all channels to the account socket connection
         */
        this._channelManager.connectChannels();

        /**
         * Setup ping response timer for socket connection
         */
        let pingTimer = null;
        let pingTimeoutTimer = null;
        const pingId = randomUUID();
        this._socketClient.onMessage((message) => {
            if(message.type === 'welcome') {
                pingTimer = setInterval(() => {
                    try {
                        context._socketClient.sendMessage({
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
                        console.log('System: account disconnected on error:', ex);

                        clearInterval(pingTimer);
                        pingTimer = null;
                        clearTimeout(pingTimeoutTimer);
                        pingTimeoutTimer = null;

                        context.disconnect();
                        context.connect();
                    }
                    
                    // console.log('System: account connection (' + context._account.id + ') ping: ' + pingId);
                }, webSocketPingInterval);
            }
            else if(message.type === 'pong' && message.id == pingId) {
                clearTimeout(pingTimeoutTimer);
                pingTimeoutTimer = null;

                // console.log('System: account connection (' + context._account.id + ') pong: ' + pingId);
            }
        });
    }

    disconnect()
    {
        this._socketClient.disconnect();
    }

    onAccountConnect(callback: ({accountId}) => void)
    {
        this._eventBus.on('onAccountConnect', callback);
    }

    onAccountDisconnect(callback: ({accountId}) => void)
    {
        this._eventBus.on('onAccountDisconnect', callback);
    }

    onConnect(callback: ({accountId, channel, message}) => void)
    {
        let context = this;

        this._channelManager.onConnect(({channel, message}) => {
            callback({accountId: context._account.id, channel, message});
        });
    }

    onDisconnect(callback: ({accountId, channel, message}) => void)
    {
        let context = this;

        this._channelManager.onDisconnect(({channel, message}) => {
            callback({accountId: context._account.id, channel, message});
        });
    }

    onError(callback: ({accountId, channel, error}) => void)
    {
        let context = this;

        this._channelManager.onError(({channel, error}) => {
            callback({accountId: context._account.id, channel, error});
        });
    }

    onMessage(callback: ({accountId, channel, message}) => void)
    {
        let context = this;

        this._channelManager.onMessage(({channel, message}) => {
            callback({accountId: context._account.id, channel, message});
        });
    }
}