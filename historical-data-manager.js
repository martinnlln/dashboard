/**
 * Historical Data Manager
 * =======================
 * Fetches, stores, and manages historical market data
 */

class HistoricalDataManager {
    constructor() {
        this.historicalData = new Map();
        this.isLoading = false;
        this.dbName = 'CryptoVaultDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Initialize IndexedDB for local storage
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('candles')) {
                    db.createObjectStore('candles', { keyPath: ['symbol', 'timeframe', 'timestamp'] });
                }
                
                if (!db.objectStoreNames.contains('indicators')) {
                    db.createObjectStore('indicators', { keyPath: ['symbol', 'timeframe', 'timestamp'] });
                }
            };
        });
    }

    /**
     * Fetch historical data from exchange
     */
    async fetchHistoricalData(symbol, timeframe, limit = 1000) {
        console.log(`📥 Fetching ${limit} ${timeframe} candles for ${symbol}...`);
        this.isLoading = true;

        try {
            const candles = await apiManager.getBinanceKlines(
                symbol,
                this.mapTimeframeToInterval(timeframe),
                limit
            );

            if (candles && candles.length > 0) {
                // Store in memory
                const key = `${symbol}_${timeframe}`;
                this.historicalData.set(key, candles);

                // Store in IndexedDB
                await this.saveToIndexedDB(symbol, timeframe, candles);

                console.log(`✅ Fetched ${candles.length} candles`);
                Utils.showToast(`Downloaded ${candles.length} historical candles`, 'success');

                return candles;
            }

            return [];
        } catch (err) {
            console.error('Failed to fetch historical data:', err);
            Utils.showToast('Failed to download historical data', 'error');
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Fetch multiple timeframes at once
     */
    async fetchMultipleTimeframes(symbol, timeframes = ['1m', '5m', '15m', '1h', '4h']) {
        const promises = timeframes.map(tf => 
            this.fetchHistoricalData(symbol, tf, 1000)
        );

        try {
            const results = await Promise.all(promises);
            Utils.showToast('All historical data downloaded', 'success');
            return results;
        } catch (err) {
            console.error('Failed to fetch multiple timeframes:', err);
            return [];
        }
    }

    /**
     * Get historical data from memory or DB
     */
    async getHistoricalData(symbol, timeframe) {
        const key = `${symbol}_${timeframe}`;
        
        // Check memory first
        if (this.historicalData.has(key)) {
            return this.historicalData.get(key);
        }

        // Try to load from IndexedDB
        const data = await this.loadFromIndexedDB(symbol, timeframe);
        
        if (data && data.length > 0) {
            this.historicalData.set(key, data);
            return data;
        }

        // Not found - fetch from API
        return await this.fetchHistoricalData(symbol, timeframe);
    }

    /**
     * Save candles to IndexedDB
     */
    async saveToIndexedDB(symbol, timeframe, candles) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['candles'], 'readwrite');
            const store = transaction.objectStore('candles');

            candles.forEach(candle => {
                store.put({
                    symbol,
                    timeframe,
                    timestamp: candle.timestamp,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                });
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Load candles from IndexedDB
     */
    async loadFromIndexedDB(symbol, timeframe) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['candles'], 'readonly');
            const store = transaction.objectStore('candles');
            const candles = [];

            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const data = cursor.value;
                    if (data.symbol === symbol && data.timeframe === timeframe) {
                        candles.push({
                            timestamp: data.timestamp,
                            open: data.open,
                            high: data.high,
                            low: data.low,
                            close: data.close,
                            volume: data.volume
                        });
                    }
                    cursor.continue();
                } else {
                    resolve(candles.sort((a, b) => a.timestamp - b.timestamp));
                }
            };

            cursorRequest.onerror = () => reject(cursorRequest.error);
        });
    }

    /**
     * Export historical data to CSV
     */
    exportToCSV(symbol, timeframe) {
        const key = `${symbol}_${timeframe}`;
        const data = this.historicalData.get(key);

        if (!data || data.length === 0) {
            Utils.showToast('No data to export', 'error');
            return;
        }

        const csvData = data.map(candle => ({
            timestamp: new Date(candle.timestamp).toISOString(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        }));

        const filename = `${symbol}_${timeframe}_${Date.now()}.csv`;
        Utils.exportToCSV(csvData, filename);
    }

    /**
     * Map timeframe to Binance interval
     */
    mapTimeframeToInterval(timeframe) {
        const map = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1h',
            '4h': '4h',
            '1d': '1d'
        };
        return map[timeframe] || '5m';
    }

    /**
     * Calculate statistics on historical data
     */
    calculateStatistics(candles) {
        if (!candles || candles.length === 0) return null;

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const returns = [];

        for (let i = 1; i < closes.length; i++) {
            returns.push((closes[i] - closes[i-1]) / closes[i-1]);
        }

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

        return {
            startDate: new Date(candles[0].timestamp),
            endDate: new Date(candles[candles.length - 1].timestamp),
            totalCandles: candles.length,
            startPrice: candles[0].open,
            endPrice: candles[candles.length - 1].close,
            totalReturn: ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100,
            avgVolatility: volatility * 100,
            maxPrice: Math.max(...closes),
            minPrice: Math.min(...closes),
            avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length
        };
    }

    /**
     * Clear all stored data
     */
    async clearAllData() {
        this.historicalData.clear();

        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['candles', 'indicators'], 'readwrite');
            
            transaction.objectStore('candles').clear();
            transaction.objectStore('indicators').clear();

            transaction.oncomplete = () => {
                Utils.showToast('Historical data cleared', 'success');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Get storage info
     */
    getStorageInfo() {
        let totalCandles = 0;
        let totalSize = 0;

        this.historicalData.forEach((data, key) => {
            totalCandles += data.length;
            totalSize += JSON.stringify(data).length;
        });

        return {
            symbols: this.historicalData.size,
            totalCandles,
            estimatedSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
            isLoading: this.isLoading
        };
    }
}

// Create global instance
const historicalDataManager = new HistoricalDataManager();
