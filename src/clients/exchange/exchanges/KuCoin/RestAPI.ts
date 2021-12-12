import axios from 'axios';

/**
 * Get data from the KuCoin REST API
 */

export default class KuCoinRestAPI
{
    baseURL: string;

    constructor(baseURL: string)
    {
        this.baseURL = baseURL;
    }

    /**
     * Get initial data and connect token
     */
    async getInitialData()
    {
        const res = await axios.post(this.baseURL + '/api/v1/bullet-public');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }

    /**
     * Get initial data and connect token for a given account
     */
    async getPrivateInitialData(authToken: string)
    {
        const res = await axios.post(this.baseURL + '/api/v1/bullet-private');

        if(!res || !res.data) {
            return [];
        }

        return res.data;
    }
}