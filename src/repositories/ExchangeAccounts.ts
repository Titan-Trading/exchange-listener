
/**
 * Singleton class for storing all exchange accounts in memory
 */

export default class ExchangeAccounts
{
    private static instance: ExchangeAccounts;
    private exchangeAccounts: any;

    /**
     * Get the instance of the singleton class
     * 
     * @returns ExchangeAccounts
     */
    public static getInstance(): ExchangeAccounts
    {
        if(!ExchangeAccounts.instance) {
            ExchangeAccounts.instance = new ExchangeAccounts();
        }

        return ExchangeAccounts.instance;
    }

    /**
     * Get one or all exchange accounts
     * 
     * @param id Id of the exchange account to return (optional)
     * @returns any
     */
    public get(id: Number = null)
    {
        if(!id) {
            return this.exchangeAccounts;
        }

        for(let iExchangeAccount in this.exchangeAccounts) {
            if(this.exchangeAccounts[iExchangeAccount].id == id) {
                return this.exchangeAccounts[iExchangeAccount];
            }
        }

        return null;
    }

    /**
     * Store a list of exchange accounts
     * 
     * @param data List of exchange accounts to store
     */
    public set(data: any)
    {
        this.exchangeAccounts = data;
    }
}