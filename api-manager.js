/**
 * API Manager
 * ===========
 * Handles REST API calls to exchanges and CoinGlass
 */

class APIManager {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 60000; // 1 minute
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * Fetch data from CoinGlass API
     */
    async fetchCoinGlass(endpoint, params = {}) {
        if (!CONFIG.API.COINGLASS.API_KEY) {
            console.warn('CoinGlass API key not configured');
            return null;
        }

        const url = new URL(CONFIG.API.COINGLASS.BASE_URL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.API.COINGLASS.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`CoinGlass API error: ${response.status}`);
            }

            const data = await response.json();
            return data.data || data;
        } catch (err) {
            console.error('CoinGlass API error:', err);
            return null;
        }
    }

    /**
     * Get liquidation data from CoinGlass
     */
    async getLiquidations(symbol = 'BTC', timeRange = '24h') {
        return await this.fetchCoinGlass(CONFIG.API.COINGLASS.ENDPOINTS.LIQUIDATION, {
            symbol,
            timeRange
        });
    }

    /**
     * Get liquidation heatmap from CoinGlass
     */
    async getLiquidationHeatmap(symbol = 'BTC') {
        return await this.fetchCoinGlass(CONFIG.API.COINGLASS.ENDPOINTS.LIQUIDATION_HEATMAP, {
            symbol
        });
    }

    /**
     * Fetch from Binance API
     */
    async fetchBinance(endpoint, params = {}) {
        const url = new URL(CONFIG.API.BINANCE.REST_URL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.status}`);
            }
            return await response.json();
        } catch (err) {
            console.error('Binance API error:', err);
            return null;
        }
    }

    /**
     * Get 24h ticker from Binance
     */
    async getBinanceTicker(symbol) {
        const cacheKey = `binance_ticker_${symbol}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchBinance(CONFIG.API.BINANCE.ENDPOINTS.TICKER, { symbol });
        if (data) {
            this.setCache(cacheKey, data);
        }
        return data;
    }

    /**
     * Get historical candles from Binance
     */
    async getBinanceKlines(symbol, interval, limit = 500) {
        const data = await this.fetchBinance(CONFIG.API.BINANCE.ENDPOINTS.KLINES, {
            symbol,
            interval,
            limit
        });

        if (!data) return [];

        // Convert to standard format
        return data.map(candle => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }

    /**
     * Get order book from Binance
     */
    async getBinanceOrderBook(symbol, limit = 50) {
        const data = await this.fetchBinance(CONFIG.API.BINANCE.ENDPOINTS.ORDERBOOK, {
            symbol,
            limit
        });

        if (!data) return { bids: [], asks: [] };

        return {
            bids: data.bids.map(([price, qty]) => [parseFloat(price), parseFloat(qty)]),
            asks: data.asks.map(([price, qty]) => [parseFloat(price), parseFloat(qty)])
        };
    }

    /**
     * Get open interest from Binance
     */
    async getBinanceOpenInterest(symbol) {
        const cacheKey = `binance_oi_${symbol}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchBinance(CONFIG.API.BINANCE.ENDPOINTS.OI, { symbol });
        if (data) {
            this.setCache(cacheKey, data);
        }
        return data;
    }

    /**
     * Get funding rate from Binance
     */
    async getBinanceFunding(symbol) {
        const cacheKey = `binance_funding_${symbol}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchBinance(CONFIG.API.BINANCE.ENDPOINTS.FUNDING, { 
            symbol,
            limit: 1
        });

        if (data && data.length > 0) {
            this.setCache(cacheKey, data[0]);
            return data[0];
        }
        return null;
    }

    /**
     * Fetch from Bybit API
     */
    async fetchBybit(endpoint, params = {}) {
        const url = new URL(CONFIG.API.BYBIT.REST_URL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.status}`);
            }
            const json = await response.json();
            return json.result || json;
        } catch (err) {
            console.error('Bybit API error:', err);
            return null;
        }
    }

    /**
     * Get ticker from Bybit
     */
    async getBybitTicker(symbol) {
        const cacheKey = `bybit_ticker_${symbol}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchBybit(CONFIG.API.BYBIT.ENDPOINTS.TICKER, {
            category: 'linear',
            symbol
        });

        if (data && data.list && data.list.length > 0) {
            const ticker = data.list[0];
            this.setCache(cacheKey, ticker);
            return ticker;
        }
        return null;
    }

    /**
     * Get historical candles from Bybit
     */
    async getBybitKlines(symbol, interval, limit = 500) {
        const data = await this.fetchBybit(CONFIG.API.BYBIT.ENDPOINTS.KLINES, {
            category: 'linear',
            symbol,
            interval,
            limit
        });

        if (!data || !data.list) return [];

        return data.list.map(candle => ({
            timestamp: parseInt(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        })).reverse();
    }

    /**
     * Fetch from OKX API
     */
    async fetchOKX(endpoint, params = {}) {
        const url = new URL(CONFIG.API.OKX.REST_URL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`OKX API error: ${response.status}`);
            }
            const json = await response.json();
            return json.data || json;
        } catch (err) {
            console.error('OKX API error:', err);
            return null;
        }
    }

    /**
     * Get ticker from OKX
     */
    async getOKXTicker(symbol) {
        const cacheKey = `okx_ticker_${symbol}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchOKX(CONFIG.API.OKX.ENDPOINTS.TICKER, {
            instId: symbol
        });

        if (data && data.length > 0) {
            this.setCache(cacheKey, data[0]);
            return data[0];
        }
        return null;
    }

    /**
     * Get market data for symbol from all exchanges
     */
    async getMultiExchangeData(symbol) {
        const [binance, bybit, okx] = await Promise.all([
            this.getBinanceTicker(symbol),
            this.getBybitTicker(symbol),
            this.getOKXTicker(symbol)
        ]);

        return {
            binance: binance ? {
                price: parseFloat(binance.lastPrice),
                volume: parseFloat(binance.volume),
                change: parseFloat(binance.priceChangePercent)
            } : null,
            bybit: bybit ? {
                price: parseFloat(bybit.lastPrice),
                volume: parseFloat(bybit.volume24h),
                change: parseFloat(bybit.price24hPcnt) * 100
            } : null,
            okx: okx ? {
                price: parseFloat(okx.last),
                volume: parseFloat(okx.vol24h),
                change: ((parseFloat(okx.last) - parseFloat(okx.open24h)) / parseFloat(okx.open24h)) * 100
            } : null
        };
    }

    /**
     * Calculate arbitrage opportunities
     */
    calculateArbitrage(multiExchangeData) {
        const exchanges = Object.keys(multiExchangeData).filter(ex => multiExchangeData[ex]);
        if (exchanges.length < 2) return [];

        const opportunities = [];
        
        for (let i = 0; i < exchanges.length; i++) {
            for (let j = i + 1; j < exchanges.length; j++) {
                const ex1 = exchanges[i];
                const ex2 = exchanges[j];
                const price1 = multiExchangeData[ex1].price;
                const price2 = multiExchangeData[ex2].price;
                
                const diff = Math.abs(price1 - price2);
                const avgPrice = (price1 + price2) / 2;
                const percentDiff = (diff / avgPrice) * 100;

                if (percentDiff > 0.1) { // 0.1% threshold
                    opportunities.push({
                        buyExchange: price1 < price2 ? ex1 : ex2,
                        sellExchange: price1 < price2 ? ex2 : ex1,
                        buyPrice: Math.min(price1, price2),
                        sellPrice: Math.max(price1, price2),
                        spread: percentDiff,
                        profit: diff
                    });
                }
            }
        }

        return opportunities.sort((a, b) => b.spread - a.spread);
    }

    /**
     * Cache management
     */
    setCache(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > this.cacheDuration) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Send Telegram notification
     */
    async sendTelegramAlert(message) {
        if (!CONFIG.ALERTS.TELEGRAM.ENABLED || !CONFIG.ALERTS.TELEGRAM.BOT_TOKEN) {
            return false;
        }

        const url = `https://api.telegram.org/bot${CONFIG.ALERTS.TELEGRAM.BOT_TOKEN}/sendMessage`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: CONFIG.ALERTS.TELEGRAM.CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            return response.ok;
        } catch (err) {
            console.error('Telegram alert error:', err);
            return false;
        }
    }
}

// Create global instance
const apiManager = new APIManager();
