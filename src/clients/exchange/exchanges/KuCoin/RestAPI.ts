import axios from 'axios';
import crypto, { sign } from 'crypto';

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
    async getPrivateInitialData(config: {apiKey: string, apiKeySecret: string, apiKeyPassphrase: string, apiKeyVersion: string})
    {
        // NOTE: passphrase is passed in plain text for v1 and encrypted with the the api key secret for version 2

        try {
            // generate timstamp
            const timestamp = +new Date();
            // console.log(timestamp);

            // console.log(config);

            if(!config.apiKeySecret || !config.apiKeyPassphrase) {
                return null;
            }

            // generate signature
            const stringToSign = timestamp.toString() + 'POST' + '/api/v1/bullet-private';
            const signature = crypto.createHmac('sha256', config.apiKeySecret).update(stringToSign).digest('base64');
            // console.log(stringToSign);
            // console.log(signature);

            // encrypt passphrase for version 2 api
            const encryptedPassphrase = crypto.createHmac('sha256', config.apiKeySecret).update(config.apiKeyPassphrase).digest('base64');
            // console.log(encryptedPassphrase);

            const res = await axios.post(this.baseURL + '/api/v1/bullet-private', null, {
                headers: {
                    'KC-API-KEY': config.apiKey,
                    'KC-API-SIGN': signature,
                    'KC-API-TIMESTAMP': timestamp.toString(),
                    'KC-API-PASSPHRASE': encryptedPassphrase,
                    'KC-API-KEY-VERSION': config.apiKeyVersion
                }
            });

            // console.log(res.data);

            return res.data;
        }
        catch(err) {
            console.log(err);

            return null;
        }
    }
}