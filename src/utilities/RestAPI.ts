import RestClient from './RestClient';

/**
 * Get data from the REST API
 */

export default class RestAPI extends RestClient
{
    /**
     * Get exchanges
     */
    async getExchanges()
    {
        const res = await this.client.get(this.baseURL + '/exchanges');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get used ticket symbols (all exchanges)
     */
    async getTickerSymbols()
    {
        const res = await this.client.get(this.baseURL + '/symbols');

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
        const res = await this.client.get(this.baseURL + '/indicators');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get connection exchanges/exchange accounts
     */
    async getExchangeAccounts()
    {
        const res = await this.client.get(this.baseURL + '/connected-exchanges');
 
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
        const res = await this.client.get(this.baseURL + '/bots/sessions');

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
        const res = await this.client.put(this.baseURL + '/bots/' + botId + '/sessions/' + id, data);
 
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
        const res = await this.client.get(this.baseURL + '/conditional-trades');

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
        const res = await this.client.put(this.baseURL + '/conditional-trades/' + id, data);
 
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
        const res = await this.client.put(this.baseURL + '/orders', data);
 
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
        const res = await this.client.put(this.baseURL + '/orders/' + id, data);
 
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
        const res = await this.client.put(this.baseURL + '/orders/' + id + '/fills', data);
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }
}