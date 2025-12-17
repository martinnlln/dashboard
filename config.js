/**
 * CryptoVault Terminal Configuration
 * =================================
 */

const CONFIG = {
    // API Endpoints
    API: {
        COINGLASS: {
            BASE_URL: 'https://open-api.coinglass.com/api/pro/v1',
            ENDPOINTS: {
                LIQUIDATION: '/futures/liquidation/history',
                LIQUIDATION_HEATMAP: '/futures/liquidation/heatmap',
                OI: '/futures/openInterest/history',
                FUNDING: '/futures/fundingRate/history'
            },
            // Note: Add your API key from https://www.coinglass.com/
            API_KEY: ''
        },
        BINANCE: {
            REST_URL: 'https://fapi.binance.com',
            WS_URL: 'wss://fstream.binance.com',
            ENDPOINTS: {
                TICKER: '/fapi/v1/ticker/24hr',
                KLINES: '/fapi/v1/klines',
                TRADES: '/fapi/v1/aggTrades',
                ORDERBOOK: '/fapi/v1/depth',
                OI: '/fapi/v1/openInterest',
                FUNDING: '/fapi/v1/fundingRate'
            }
        },
        BYBIT: {
            REST_URL: 'https://api.bybit.com',
            WS_URL: 'wss://stream.bybit.com/v5/public/linear',
            ENDPOINTS: {
                TICKER: '/v5/market/tickers',
                KLINES: '/v5/market/kline',
                TRADES: '/v5/market/recent-trade',
                ORDERBOOK: '/v5/market/orderbook',
                OI: '/v5/market/open-interest',
                FUNDING: '/v5/market/funding/history'
            }
        },
        OKX: {
            REST_URL: 'https://www.okx.com',
            WS_URL: 'wss://ws.okx.com:8443/ws/v5/public',
            ENDPOINTS: {
                TICKER: '/api/v5/market/ticker',
                KLINES: '/api/v5/market/candles',
                TRADES: '/api/v5/market/trades',
                ORDERBOOK: '/api/v5/market/books',
                OI: '/api/v5/public/open-interest',
                FUNDING: '/api/v5/public/funding-rate'
            }
        }
    },

    // Default Settings
    DEFAULT: {
        SYMBOL: 'BTCUSDT',
        TIMEFRAME: '5m',
        ORDERBOOK_DEPTH: 50,
        CHART_THEME: 'dark',
        UPDATE_INTERVAL: 1000, // ms
        WHALE_THRESHOLD: 100000, // USD
        LIQUIDATION_THRESHOLD: 1000000, // USD for alerts
        MAX_FEED_ITEMS: 50
    },

    // Timeframe Configuration
    TIMEFRAMES: {
        '1m': { interval: 60000, label: '1 Minute' },
        '5m': { interval: 300000, label: '5 Minutes' },
        '15m': { interval: 900000, label: '15 Minutes' },
        '1h': { interval: 3600000, label: '1 Hour' },
        '4h': { interval: 14400000, label: '4 Hours' }
    },

    // Chart Configuration
    CHART: {
        LAYOUT: {
            background: { color: '#0a0e14' },
            textColor: '#e8f4ff',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace'
        },
        GRID: {
            vertLines: { color: 'rgba(0, 240, 255, 0.1)' },
            horzLines: { color: 'rgba(0, 240, 255, 0.1)' }
        },
        CROSSHAIR: {
            mode: 1,
            vertLine: {
                color: '#00f0ff',
                width: 1,
                style: 3,
                labelBackgroundColor: '#00f0ff'
            },
            horzLine: {
                color: '#00f0ff',
                width: 1,
                style: 3,
                labelBackgroundColor: '#00f0ff'
            }
        },
        WATERMARK: {
            visible: true,
            fontSize: 48,
            horzAlign: 'center',
            vertAlign: 'center',
            color: 'rgba(0, 240, 255, 0.1)',
            text: 'CRYPTOVAULT'
        }
    },

    // Alert Configuration
    ALERTS: {
        SOUND: {
            ENABLED: true,
            VOLUME: 0.5,
            SOUNDS: {
                liquidation: 'alert-liquidation.mp3',
                whale: 'alert-whale.mp3',
                price: 'alert-price.mp3'
            }
        },
        BROWSER: {
            ENABLED: true,
            ICON: '/icon.png'
        },
        TELEGRAM: {
            ENABLED: false,
            BOT_TOKEN: '', // Add your Telegram bot token
            CHAT_ID: ''    // Add your Telegram chat ID
        }
    },

    // WebSocket Configuration
    WEBSOCKET: {
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_ATTEMPTS: 10,
        PING_INTERVAL: 30000,
        BUFFER_SIZE: 1000
    },

    // Trading Pairs
    SYMBOLS: [
        { symbol: 'BTCUSDT', name: 'Bitcoin', tick: 0.1 },
        { symbol: 'ETHUSDT', name: 'Ethereum', tick: 0.01 },
        { symbol: 'SOLUSDT', name: 'Solana', tick: 0.001 },
        { symbol: 'WIFUSDT', name: 'dogwifhat', tick: 0.0001 },
        { symbol: 'BNBUSDT', name: 'BNB', tick: 0.01 },
        { symbol: 'XRPUSDT', name: 'Ripple', tick: 0.0001 },
        { symbol: 'ADAUSDT', name: 'Cardano', tick: 0.0001 },
        { symbol: 'DOGEUSDT', name: 'Dogecoin', tick: 0.00001 }
    ],

    // Exchange Configuration
    EXCHANGES: ['binance', 'bybit', 'okx'],

    // Color Configuration
    COLORS: {
        LONG: '#00ff88',
        SHORT: '#ff006e',
        NEUTRAL: '#00f0ff',
        AMBER: '#ffb800',
        BACKGROUND: '#0a0e14',
        PANEL: 'rgba(17, 24, 32, 0.85)',
        BORDER: 'rgba(0, 240, 255, 0.2)'
    },

    // Performance Configuration
    PERFORMANCE: {
        CHART_UPDATE_THROTTLE: 100, // ms
        ORDERBOOK_UPDATE_THROTTLE: 50, // ms
        FEED_UPDATE_THROTTLE: 200, // ms
        MAX_VISIBLE_CANDLES: 500,
        MAX_ORDERBOOK_ROWS: 50
    },

    // Local Storage Keys
    STORAGE: {
        SETTINGS: 'cvt_settings',
        ALERTS: 'cvt_alerts',
        FAVORITES: 'cvt_favorites',
        SESSION: 'cvt_session'
    }
};

// Feature Flags
const FEATURES = {
    COINGLASS_LIQUIDATIONS: true,
    MULTI_EXCHANGE: true,
    VOLUME_PROFILE: true,
    CVD_INDICATOR: true,
    TELEGRAM_ALERTS: false, // Requires bot token
    SESSION_REPLAY: true,
    SCREENSHOT: true,
    EXPORT_DATA: true
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, FEATURES };
}
