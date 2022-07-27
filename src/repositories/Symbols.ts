
/**
 * Singleton class for storing all symbols in memory
 */

export default class Symbols
{
    private static instance: Symbols;
    private symbols: any;

    /**
     * Get the instance of the singleton class
     * 
     * @returns Symbols
     */
    public static getInstance(): Symbols
    {
        if(!Symbols.instance) {
            Symbols.instance = new Symbols();
        }

        return Symbols.instance;
    }

    /**
     * Get one or all symbols
     * 
     * @param id Id of the symbol to return (optional)
     * @returns any
     */
    public get(id: Number = null)
    {
        if(!id) {
            return this.symbols;
        }

        for(let iSymbol in this.symbols) {
            if(this.symbols[iSymbol].id == id) {
                return this.symbols[iSymbol];
            }
        }

        return null;
    }

    /**
     * Store a list of symbols
     * 
     * @param data List of symbols to store
     */
    public set(data: any)
    {
        this.symbols = data;
    }
}