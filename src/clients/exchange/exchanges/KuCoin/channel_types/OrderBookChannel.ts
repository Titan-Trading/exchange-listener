import WebSocketClient from "../../../../../utilities/WebSocketClient";
import Channel from "../Channel";

export default class OrderBookChannel extends Channel
{
    constructor(channelName: string, channelConfig: any, socketClient: WebSocketClient)
    {
        super(channelName, socketClient);

        this._config = channelConfig;

        this._socketClient.onMessage((message) => {
            // if message from this channel subscription
            if(message.type === 'message' && message.subject && message.subject === 'level2') {
                this._eventBus.emit('onMessage', message);
            }
        });
    }
}