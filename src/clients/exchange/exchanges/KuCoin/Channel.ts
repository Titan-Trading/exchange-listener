import { randomUUID } from "crypto";
import WebSocketClient from "../../../../utilities/WebSocketClient";
import PubSub from "../../../../utilities/PubSub";

/**
 * Manage connections/subscriptions of a given channel on a given exchange
 */
export default class Channel
{
    protected _socketClient: WebSocketClient;
    protected _eventBus: PubSub;
    private _hasHelloMessage: boolean = false;
    private _messageToSend: any;

    private _isConnected: boolean = false;
    private _id: string;
    private _name: string;
    private _type: string = 'subscribe';
    private _response: boolean;
    private _privateChannel: boolean = false;
    protected _config: any;

    constructor(name: string, socketClient: WebSocketClient)
    {
        this._eventBus = new PubSub();

        this._socketClient = socketClient;

        this._id = randomUUID();
        this._name = name;
        this._type = 'subscribe';
        this._response = true;

        let context = this;

        // setup on message callback
        this._socketClient.onMessage((message) => {
            if(message.type === 'welcome') {
                context._hasHelloMessage = true;

                // has message to send, send message
                if(context._messageToSend) {
                    context._socketClient.sendMessage(context._messageToSend);
                }
            }
            // acknowledge channel update (subscribe/unsubscribe)
            else if(message.type === 'ack' && context._id === message.id) {
                if(context._type === 'subscribe') {
                    context._isConnected = true;

                    context._eventBus.emit('onConnect', message);
                }
                else if(context._type === 'unsubscribe') {
                    context._isConnected = false;

                    context._eventBus.emit('onDisconnect', message);
                }
            }
        });
    }

    /**
     * Get the channel id
     */
    public getId(): string
    {
        return this._id;
    }

    /**
     * Get the channel name
     */
    public getName(): string
    {
        return this._name;
    }

    /**
     * Get if the channel is connected or not
     */
    public isConnected(): boolean
    {
        return this._isConnected;
    }

    /**
     * Connect to an exchange channel
     */
    public connect()
    {
        // if channel is already connected/subscribed, dont send
        if(this._isConnected) {
            return;
        }

        const message = {
            id: this._id,
            type: 'subscribe',
            topic: this._config.topic,
            response: this._response,
            privateChannel: this._privateChannel
        };

        // if hello message already received
        if(this._hasHelloMessage) {
            // subscribe to the given channel
            this._socketClient.sendMessage(message);
        }
        else {
            // add subscribe message to send when hello message is received
            this._messageToSend = message;
        }
    }

    /**
     * Disconnect from an exchange channel
     */
    public disconnect()
    {
        // if channel is not already connected/subscribed, dont send
        if(!this._isConnected) {
            return;
        }

        const message = {
            id: this._id,
            type: 'unsubscribe',
            topic: this._config.topic,
            response: this._response,
            privateChannel: this._privateChannel
        };
        
        this._socketClient.sendMessage(message);
    }

    /**
     * When connected to an exchange channel
     */
    public onConnect(callback: (message) => void)
    {
        this._eventBus.on('onConnect', callback);
    }

    /**
     * When errors on an exchange channel
     */
    public onError(callback: (err) => void)
    {
        this._eventBus.on('onError', callback);
    }

    /**
     * When message on an exchange channel
     */
    public onMessage(callback: (message) => void)
    {
        this._eventBus.on('onMessage', callback);
    }

    /**
     * When disconnected from an exchange channel
     */
    public onDisconnect(callback: (message) => void)
    {
        this._eventBus.on('onDisconnect', callback);
    }
}