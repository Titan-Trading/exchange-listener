
/**
 * Singleton class for storing all exchanges in memory
 */

export default class Exchanges
{
    private static instance: Exchanges;
    private exchanges: any;

    /**
     * Get the instance of the singleton class
     * 
     * @returns Exchanges
     */
    public static getInstance(): Exchanges
    {
        if(!Exchanges.instance) {
            Exchanges.instance = new Exchanges();
        }

        return Exchanges.instance;
    }

    /**
     * Get one or all exchanges
     * 
     * @param id Id of the exchange to return (optional)
     * @returns any
     */
    public get(id: Number = null)
    {
        if(!id) {
            return this.exchanges;
        }

        for(let iExchange in this.exchanges) {
            if(this.exchanges[iExchange].id == id) {
                return this.exchanges[iExchange];
            }
        }

        return null;
    }

    /**
     * Store a list of exchanges
     * 
     * @param data List of exchanges to store
     */
    public set(data: any)
    {
        this.exchanges = data;
    }
}