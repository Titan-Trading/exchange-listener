import RestClient from './RestClient';

/**
 * Get data from the REST API
 */

export default class RestAPI extends RestClient
{
    /**
     * Get API connect token
     * @returns 
     */
    async getAPIConnectToken()
    {
        const res = await this.client.post(this.baseURL + '/api-connect-tokens');

        if(!res || !res.data) {
            return null;
        }

        return res.data.access_token;
    }

    /**
     * Get exchanges
     */
    async getExchanges()
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/exchanges');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get used ticket symbols (all exchanges)
     */
    async getTickerSymbols(exchangeId: number)
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/symbols', {exchange_id: exchangeId});

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get indicators
     */
    async getIndicators()
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/indicators');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get connection exchanges/exchange accounts
     */
    async getExchangeAccounts(exchangeId: number)
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/exchange-accounts', {exchange_id: exchangeId});
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }

    /**
     * Get all active bot sessions
     */
    async getBotSessions()
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/bots/sessions');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Update bot session
     */
    async updateBotSession(botId: Number, id: Number, data: any)
    {
        const res = await this.client.put(this.baseURL + '/admin/trading/bots/' + botId + '/sessions/' + id, data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }

    /**
     * Get all active bot sessions
     */
    async getConditionalTrades()
    {
        const res = await this.client.get(this.baseURL + '/admin/trading/conditional-trades');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Update conditional trade
     */
    async updateConditionalTrade(id: Number, data: any)
    {
        const res = await this.client.put(this.baseURL + '/admin/trading/conditional-trades/' + id, data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }

    /**
     * Add order
     */
    async addOrder(data: any)
    {
        const res = await this.client.put(this.baseURL + '/admin/trading/orders', data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }

    /**
     * Update order
     */
    async updateOrder(id: Number, data: any)
    {
        const res = await this.client.put(this.baseURL + '/admin/trading/orders/' + id, data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }

    /**
     * Add order fill
     */
    async addOrderFill(id: Number, data: any)
    {
        const res = await this.client.put(this.baseURL + '/admin/trading/orders/' + id + '/fills', data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }
}