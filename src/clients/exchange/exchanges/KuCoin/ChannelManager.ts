
import PubSub from "../../../../utilities/PubSub";
import Channel from "./Channel";

/**
 * Manages a list of channels for a given exchange
 */

export default class ChannelManager
{
    private _channels: any;
    private _eventBus: PubSub;

    constructor()
    {
        this._channels = {};
        this._eventBus = new PubSub();
    }

    /**
     * Add a channel
     */
    addChannel(channel: Channel): boolean
    {
        if(typeof this._channels[channel.getName()] === 'undefined') {
            this._channels[channel.getName()] = channel;

            return true;
        }

        return false;
    }
    
    /**
     * Get a channel by name
     */
    getChannel(channelName: string): Channel|null
    {
        if(typeof this._channels[channelName] === 'undefined') {
            return null;
        }

        return this._channels[channelName];
    }

    /**
     * Remove a channel by name
     */
    removeChannel(channelName: string): boolean
    {
        if(typeof this._channels[channelName] !== 'undefined') {
            delete this._channels[channelName];

            return true;
        }

        return false;
    }

    /**
     * Connect one or all channels
     * - setup onConnect events
     * - setup onDisconnect events
     * - setup onMessage events
     * - setup onError events
     */
    connectChannels(channelName: string = null)
    {
        let context = this;

        if(channelName && typeof this._channels[channelName] !== 'undefined') {
            const channel = this._channels[channelName];
            
            channel.onConnect((message) => {
                context._eventBus.emit('onConnect', {
                    channel,
                    message
                });
            });

            channel.onError((err) => {
                context._eventBus.emit('onError', {
                    channel,
                    error: err
                });
            });

            channel.onDisconnect((message) => {
                context._eventBus.emit('onDisconnect', {
                    channel,
                    message
                });
            });

            channel.onMessage((message) => {
                context._eventBus.emit('onMessage', {
                    channel,
                    message
                });
            });

            channel.connect();
        }
        else if(!channelName) {
            for(let iChannel in this._channels) {
                const channel = this._channels[iChannel];

                channel.onConnect((message) => {
                    context._eventBus.emit('onConnect', {
                        channel,
                        message
                    });
                });
    
                channel.onError((err) => {
                    context._eventBus.emit('onError', {
                        channel,
                        error: err
                    });
                });
    
                channel.onDisconnect((message) => {
                    context._eventBus.emit('onDisconnect', {
                        channel,
                        message
                    });
                });
    
                channel.onMessage((message) => {
                    context._eventBus.emit('onMessage', {
                        channel,
                        message
                    });
                });

                channel.connect();
            }
        }
    }

    /**
     * Disconnect one or all channels
     */
    disconnectChannels(channelName: string = null)
    {
        if(channelName && typeof this._channels[channelName] !== 'undefined') {
            const channel = this._channels[channelName];

            channel.disconnect();
        }
        else if(!channelName) {
            for(let iChannel in this._channels) {
                const channel = this._channels[iChannel];

                channel.disconnect();
            }
        }
    }

    /**
     * When a channel is connected
     */
    onConnect(callback: ({channel, message}) => void)
    {
        this._eventBus.on('onConnect', callback);
    }

    /**
     * When a channel is disconnected
     */
    onDisconnect(callback: ({channel, message}) => void)
    {
        this._eventBus.on('onDisconnect', callback);
    }

    /**
     * When a error on a channel
     */
    onError(callback: ({channel, error}) => void)
    {
        this._eventBus.on('onError', callback);
    }

    /**
     * When a message on a channel
     */
    onMessage(callback: ({channel, message}) => void)
    {
        this._eventBus.on('onMessage', callback);
    }
}