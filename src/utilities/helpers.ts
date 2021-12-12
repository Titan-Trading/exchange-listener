import crypto from 'crypto';


/**
 * CURRENCY/CONVERSIONS
 */

/**
 * Get the ticker symbol for a given exchange and trade
 * @param {string} exchangeName 
 * @param {string} baseTickerSymbol 
 * @param {string} targetTickerSymbol 
 */
export function getTickerSymbol(exchangeName, baseTickerSymbol, targetTickerSymbol) {
    switch(exchangeName) {
        case 'Binance':
            return targetTickerSymbol + baseTickerSymbol;
        case 'Deversifi':
            return baseTickerSymbol + ':' + targetTickerSymbol;
        case 'Poloniex':
            return baseTickerSymbol + '_' + targetTickerSymbol;
        case 'KuCoin':
        case 'Loopring':
            return targetTickerSymbol + '-' + baseTickerSymbol;
    }
    return null;
}

/**
 * Get the USD symbol for the given exchange
 * @param {string} exchangeName 
 */
export function getUSDSymbol(exchangeName) {
    switch(exchangeName) {
        case 'Binance':
        case 'KuCoin':
        case 'Deversifi':
        case 'Loopring':
        case 'Poloniex':
            return 'USDT';
    }
    return null;
}

/**
 * Get default currency pairs for the given exchange
 * @param {string} exchangeName 
 */
export function getDefaultPairsByExchange(exchangeName) {
    let baseSymbols = [];
    let targetSymbols = [];

    switch(exchangeName) {
        case 'Binance':
            baseSymbols = [
                'USDT',
                'BTC'
            ];
            targetSymbols = [
                'LSK',
                'ADA',
                'BTC',
                'BNB',
                'ETH',
                // 'ETC',
                // 'LTC',
                // 'NEO',
                // 'QTUM',
                // 'XRP',
                // 'QSP'
            ];
            break;

        case 'KuCoin':
            baseSymbols = [
                'USDT',
                'BTC'
            ];
            targetSymbols = [
                'LSK',
                'BTC',
                'ETH'
            ];
            break;

        case 'Poloniex':
            break;

        case 'Deversifi':
            baseSymbols = [
                'USDT',
                'ETH',
                'BTC'
            ];
            targetSymbols = [
                'BTC',
                'ETH'
            ];
            break;
            
        case 'Loopring':
            baseSymbols = [
                'USDT',
            ];
            targetSymbols = [
                'BTC',
                'ETH',
            ];
            break;
    }

    let symbols = [];
    for(let baseI in baseSymbols) {
        let baseSymbol = baseSymbols[baseI];
        for(let targetI in targetSymbols) {
            let targetSymbol = targetSymbols[targetI];

            // skip same base and target symbols
            if(baseSymbol === targetSymbol) continue;
            
            symbols.push(getTickerSymbol(exchangeName, baseSymbol, targetSymbol));
        }
    }

    return symbols;
}

/**
 * Convert prices
 * @param {string} exchangeName 
 * @param {string} srcSymbol 
 * @param {string} destSymbol 
 * @param {decimal} value 
 * @param {Object} tickerRepo 
 */
export function convertPrice(exchangeName, srcSymbol, destSymbol, value, tickerRepo) {
    if(srcSymbol === destSymbol) return value;
    let convertedPrice = getPrice(exchangeName, srcSymbol + destSymbol, tickerRepo);
    if(!convertedPrice) return null;
    return value * convertedPrice;
}

/**
 * Get current price of a currency pair
 * @param {string} exchangeName 
 * @param {string} tickerSymbol 
 * @param {Object} tickerRepo 
 */
export function getPrice(exchangeName, tickerSymbol, tickerRepo) {
    const price = tickerRepo.get(exchangeName, tickerSymbol);
    if(!price) return false;

    return parseFloat(price);
}


/**
 * CRYPTOGRAPHY
 */

/**
 * Generate random hash
 * @param {integer} length 
 */
export function getRandomHash(length) {
    let rand = Math.random().toString(36);
    rand += Math.random().toString(36);
    rand += Math.random().toString(36);
    rand += Math.random().toString(36);
    rand += Math.random().toString(36);
    rand += Math.random().toString(36);
    return rand.substr(5, length);
}

/**
 * Encrypt a string
 * @param {string} key 
 * @param {string} message 
 */
export function encrypt(key, message) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, process.env.ENCRYPTION_IV);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * Decrypt a string
 * @param {string} key 
 * @param {string} message 
 */
export function decrypt(key, message) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, process.env.ENCRYPTION_IV);
    let decrypted = decipher.update(message, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}