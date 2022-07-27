import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import moment from 'moment';
import crypto from 'crypto';

const config: AxiosRequestConfig = {
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
};

export default class RestClient
{
    baseURL;
    apiKey;
    apiKeySecret;
    client;

    constructor(baseURL: string, apiKey: string, apiKeySecret: string)
    {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.apiKeySecret = apiKeySecret;

        this.client = axios.create(config);

        // sign every request automatically
        this.client.interceptors.request.use(req => {
            const timestamp = moment().unix();

            req.headers['st-api-timestamp'] = timestamp.toString();
            req.headers['st-api-key'] = this.apiKey;
            req.headers['st-api-signature'] = this.signRequest(timestamp, req);
        
            return req;
        });
    }

    /**
     * Generate a signature for a given request
     * @param timestamp 
     * @param method 
     * @param url 
     * @param body 
     * @returns 
     */
    signRequest(timestamp: number, req: any): string
    {
        const toSign = timestamp + req.method + req.url.replace(this.baseURL, '') + (req.data ? JSON.stringify(req.data) : '');

        const hashed = crypto
            .createHmac('sha512', this.apiKeySecret)
            .update(toSign)
            .digest()
            .toString('base64');

        return hashed;
    }
}