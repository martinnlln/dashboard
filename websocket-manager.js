/**
 * WebSocket Manager
 * =================
 * Manages WebSocket connections to multiple exchanges
 */

class WebSocketManager {
    constructor() {
        this.connections = new Map();
        this.subscriptions = new Map();
        this.reconnectAttempts = new Map();
        this.callbacks = new Map();
        this.isConnected = new Map();
    }

    /**
     * Connect to exchange WebSocket
     */
    connect(exchange, symbol) {
        const key = `${exchange}_${symbol}`;
        
        if (this.connections.has(key)) {
            console.log(`Already connected to ${exchange} for ${symbol}`);
            return;
        }

        const wsUrl = this.getWebSocketURL(exchange, symbol);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`✓ Connected to ${exchange} WebSocket`);
            this.isConnected.set(key, true);
            this.reconnectAttempts.set(key, 0);
            this.subscribe(exchange, symbol, ws);
        };

        ws.onmessage = (event) => {
            this.handleMessage(exchange, symbol, event.data);
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error for ${exchange}:`, error);
        };

        ws.onclose = () => {
            console.log(`✗ Disconnected from ${exchange} WebSocket`);
            this.isConnected.set(key, false);
            this.connections.delete(key);
            this.reconnect(exchange, symbol);
        };

        this.connections.set(key, ws);
    }

    /**
     * Get WebSocket URL for exchange
     */
    getWebSocketURL(exchange, symbol) {
        switch (exchange) {
            case 'binance':
                const binanceSymbol = symbol.toLowerCase();
                return `${CONFIG.API.BINANCE.WS_URL}/stream?streams=${binanceSymbol}@aggTrade/${binanceSymbol}@depth@100ms/${binanceSymbol}@miniTicker`;
            
            case 'bybit':
                return CONFIG.API.BYBIT.WS_URL;
            
            case 'okx':
                return CONFIG.API.OKX.WS_URL;
            
            default:
                throw new Error(`Unknown exchange: ${exchange}`);
        }
    }

    /**
     * Subscribe to data streams
     */
    subscribe(exchange, symbol, ws) {
        switch (exchange) {
            case 'binance':
                // Binance subscriptions are in the URL
                break;
            
            case 'bybit':
                ws.send(JSON.stringify({
                    op: 'subscribe',
                    args: [
                        `publicTrade.${symbol}`,
                        `orderbook.50.${symbol}`,
                        `tickers.${symbol}`
                    ]
                }));
                break;
            
            case 'okx':
                ws.send(JSON.stringify({
                    op: 'subscribe',
                    args: [
                        { channel: 'trades', instId: symbol },
                        { channel: 'books5', instId: symbol },
                        { channel: 'tickers', instId: symbol }
                    ]
                }));
                break;
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(exchange, symbol, data) {
        try {
            const message = JSON.parse(data);
            
            switch (exchange) {
                case 'binance':
                    this.handleBinanceMessage(symbol, message);
                    break;
                case 'bybit':
                    this.handleBybitMessage(symbol, message);
                    break;
                case 'okx':
                    this.handleOKXMessage(symbol, message);
                    break;
            }
        } catch (err) {
            console.error(`Failed to parse message from ${exchange}:`, err);
        }
    }

    /**
     * Handle Binance message
     */
    handleBinanceMessage(symbol, message) {
        if (message.stream) {
            const [, type] = message.stream.split('@');
            const data = message.data;

            if (type === 'aggTrade') {
                this.emit('trade', {
                    exchange: 'binance',
                    symbol,
                    price: parseFloat(data.p),
                    quantity: parseFloat(data.q),
                    side: data.m ? 'sell' : 'buy',
                    timestamp: data.T
                });
            } else if (type === 'depth') {
                this.emit('orderbook', {
                    exchange: 'binance',
                    symbol,
                    bids: data.b,
                    asks: data.a,
                    timestamp: data.T || Date.now()
                });
            } else if (type === 'miniTicker') {
                this.emit('ticker', {
                    exchange: 'binance',
                    symbol,
                    price: parseFloat(data.c),
                    change: parseFloat(data.P),
                    volume: parseFloat(data.v),
                    timestamp: data.E
                });
            }
        }
    }

    /**
     * Handle Bybit message
     */
    handleBybitMessage(symbol, message) {
        if (message.topic) {
            const topic = message.topic;
            const data = message.data;

            if (topic.startsWith('publicTrade')) {
                data.forEach(trade => {
                    this.emit('trade', {
                        exchange: 'bybit',
                        symbol,
                        price: parseFloat(trade.price),
                        quantity: parseFloat(trade.size),
                        side: trade.side.toLowerCase(),
                        timestamp: trade.time
                    });
                });
            } else if (topic.startsWith('orderbook')) {
                this.emit('orderbook', {
                    exchange: 'bybit',
                    symbol,
                    bids: data.b || [],
                    asks: data.a || [],
                    timestamp: data.ts || Date.now()
                });
            } else if (topic.startsWith('tickers')) {
                this.emit('ticker', {
                    exchange: 'bybit',
                    symbol,
                    price: parseFloat(data.lastPrice),
                    change: parseFloat(data.price24hPcnt) * 100,
                    volume: parseFloat(data.volume24h),
                    timestamp: data.timestamp
                });
            }
        }
    }

    /**
     * Handle OKX message
     */
    handleOKXMessage(symbol, message) {
        if (message.arg && message.data) {
            const channel = message.arg.channel;
            const data = message.data[0];

            if (channel === 'trades') {
                this.emit('trade', {
                    exchange: 'okx',
                    symbol,
                    price: parseFloat(data.px),
                    quantity: parseFloat(data.sz),
                    side: data.side,
                    timestamp: parseInt(data.ts)
                });
            } else if (channel === 'books5') {
                this.emit('orderbook', {
                    exchange: 'okx',
                    symbol,
                    bids: data.bids || [],
                    asks: data.asks || [],
                    timestamp: parseInt(data.ts)
                });
            } else if (channel === 'tickers') {
                const changePercent = ((parseFloat(data.last) - parseFloat(data.open24h)) / parseFloat(data.open24h)) * 100;
                this.emit('ticker', {
                    exchange: 'okx',
                    symbol,
                    price: parseFloat(data.last),
                    change: changePercent,
                    volume: parseFloat(data.vol24h),
                    timestamp: parseInt(data.ts)
                });
            }
        }
    }

    /**
     * Register event callback
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }

    /**
     * Emit event to callbacks
     */
    emit(event, data) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in ${event} callback:`, err);
                }
            });
        }
    }

    /**
     * Reconnect to WebSocket
     */
    reconnect(exchange, symbol) {
        const key = `${exchange}_${symbol}`;
        const attempts = this.reconnectAttempts.get(key) || 0;

        if (attempts >= CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS) {
            console.error(`Max reconnection attempts reached for ${exchange}`);
            Utils.showToast(`Failed to connect to ${Utils.formatExchange(exchange)}`, 'error');
            return;
        }

        console.log(`Reconnecting to ${exchange} (attempt ${attempts + 1})...`);
        this.reconnectAttempts.set(key, attempts + 1);

        setTimeout(() => {
            this.connect(exchange, symbol);
        }, CONFIG.WEBSOCKET.RECONNECT_INTERVAL);
    }

    /**
     * Disconnect from exchange
     */
    disconnect(exchange, symbol) {
        const key = `${exchange}_${symbol}`;
        const ws = this.connections.get(key);
        
        if (ws) {
            ws.close();
            this.connections.delete(key);
            this.isConnected.set(key, false);
            console.log(`Disconnected from ${exchange} ${symbol}`);
        }
    }

    /**
     * Disconnect all connections
     */
    disconnectAll() {
        this.connections.forEach((ws, key) => {
            ws.close();
        });
        this.connections.clear();
        this.isConnected.clear();
        console.log('Disconnected from all WebSockets');
    }

    /**
     * Check if connected to exchange
     */
    isExchangeConnected(exchange, symbol) {
        const key = `${exchange}_${symbol}`;
        return this.isConnected.get(key) || false;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        const status = {};
        CONFIG.EXCHANGES.forEach(exchange => {
            status[exchange] = this.isExchangeConnected(exchange, CONFIG.DEFAULT.SYMBOL);
        });
        return status;
    }

    /**
     * Send ping to keep connection alive
     */
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.connections.forEach((ws, key) => {
                if (ws.readyState === WebSocket.OPEN) {
                    // Send ping based on exchange
                    const [exchange] = key.split('_');
                    if (exchange === 'binance') {
                        // Binance handles ping automatically
                    } else if (exchange === 'bybit') {
                        ws.send(JSON.stringify({ op: 'ping' }));
                    } else if (exchange === 'okx') {
                        ws.send('ping');
                    }
                }
            });
        }, CONFIG.WEBSOCKET.PING_INTERVAL);
    }

    /**
     * Stop ping interval
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

// Create global instance
const wsManager = new WebSocketManager();
