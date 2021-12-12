import axios from 'axios';

/**
 * Get data from the REST API
 */

export default class RestAPI
{
    baseURL: string;

    constructor(baseURL: string)
    {
        this.baseURL = baseURL;
    }

    /**
     * Get exchanges
     */
    async getExchanges()
    {
        const res = await axios.get(this.baseURL + '/exchanges');

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
        const res = await axios.get(this.baseURL + '/symbols');

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
        const res = await axios.get(this.baseURL + '/connected-exchanges');
 
        if(!res || !res.data) {
            return [];
        }
 
        return res.data;
    }
}