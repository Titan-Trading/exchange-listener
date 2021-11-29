/**
 * Get data from the REST API
 */

const axios = require('axios');

const API_BASE = process.env.API_URL;

class API
{
    /**
     * Get used ticket symbols (all exchanges)
     */
    async getTickerSymbols()
    {
        const res = await axios.get(API_BASE + '/symbols');

        if(!res) {
            return null;
        }

        return res;
    }
}

module.exports = API;