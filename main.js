/**
 * Main Application
 * ================
 * Initializes and coordinates all managers
 */

class TradingDashboard {
    constructor() {
        this.currentSymbol = CONFIG.DEFAULT.SYMBOL;
        this.currentTimeframe = CONFIG.DEFAULT.TIMEFRAME;
        this.isInitialized = false;
        this.updateInterval = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 Initializing CryptoVault Terminal...');

        try {
            // Show loading overlay
            this.showLoading();

            // Initialize managers
            await this.initializeManagers();

            // Setup UI event handlers
            this.setupEventHandlers();

            // Connect to WebSocket streams
            this.connectWebSockets();

            // Load initial data
            await this.loadInitialData();

            // Start data updates
            this.startDataUpdates();

            // Hide loading overlay
            this.hideLoading();

            this.isInitialized = true;
            console.log('✅ CryptoVault Terminal initialized');

            Utils.showToast('Terminal ready', 'success');

        } catch (err) {
            console.error('Failed to initialize:', err);
            Utils.showToast('Initialization failed: ' + err.message, 'error');
            this.hideLoading();
        }
    }

    /**
     * Initialize all managers
     */
    async initializeManagers() {
        // Initialize chart manager
        chartManager.init();

        // Initialize order book manager
        orderbookManager.init();

        // Initialize liquidation manager
        liquidationManager.init();

        // Initialize metrics manager
        metricsManager.init();

        // Initialize alert manager
        alertManager.init();

        // Start WebSocket ping
        wsManager.startPingInterval();
    }

    /**
     * Setup UI event handlers
     */
    setupEventHandlers() {
        // Symbol selector
        const symbolSelect = document.getElementById('symbol-select');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.changeSymbol(e.target.value);
            });
        }

        // Timeframe buttons
        const tfButtons = document.querySelectorAll('.tf-btn');
        tfButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tfButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.changeTimeframe(btn.dataset.tf);
            });
        });

        // Chart indicator buttons
        const chartButtons = document.querySelectorAll('.chart-btn');
        chartButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                chartManager.toggleIndicator(btn.dataset.indicator);
            });
        });

        // Control buttons
        this.setupControlButtons();

        // Settings modal
        this.setupSettingsModal();
    }

    /**
     * Setup control buttons
     */
    setupControlButtons() {
        const screenshotBtn = document.getElementById('screenshot-btn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => {
                Utils.takeScreenshot('main-chart');
            });
        }

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                document.getElementById('settings-modal').classList.remove('hidden');
            });
        }
    }

    /**
     * Setup settings modal
     */
    setupSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const closeBtn = document.getElementById('settings-modal-close');
        const saveBtn = document.getElementById('save-settings-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                modal.classList.add('hidden');
                Utils.showToast('Settings saved', 'success');
            });
        }

        // Close on background click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // Load settings
        this.loadSettings();
    }

    /**
     * Connect to WebSocket streams
     */
    connectWebSockets() {
        console.log('📡 Connecting to WebSocket streams...');

        // Connect to exchanges
        CONFIG.EXCHANGES.forEach(exchange => {
            wsManager.connect(exchange, this.currentSymbol);
        });

        // Setup event listeners
        wsManager.on('trade', (trade) => {
            this.handleTrade(trade);
        });

        wsManager.on('orderbook', (orderbook) => {
            this.handleOrderBook(orderbook);
        });

        wsManager.on('ticker', (ticker) => {
            this.handleTicker(ticker);
        });
    }

    /**
     * Handle incoming trade
     */
    handleTrade(trade) {
        // Update chart
        chartManager.updateRealtimeCandle(trade);

        // Update metrics
        metricsManager.processTrade(trade);

        // Check alerts
        alertManager.checkAlerts({
            price: trade.price
        });
    }

    /**
     * Handle order book update
     */
    handleOrderBook(orderbook) {
        orderbookManager.update(orderbook);
    }

    /**
     * Handle ticker update
     */
    handleTicker(ticker) {
        this.updateTopBar(ticker);
    }

    /**
     * Update top bar metrics
     */
    updateTopBar(ticker) {
        // Update price
        const priceEl = document.getElementById('current-price');
        if (priceEl) {
            priceEl.textContent = Utils.formatPrice(ticker.price, ticker.symbol);
        }

        // Update 24h change
        const changeEl = document.getElementById('price-change');
        if (changeEl) {
            const changeText = Utils.formatPercent(ticker.change);
            changeEl.textContent = changeText;
            changeEl.className = 'metric-change ' + (ticker.change >= 0 ? 'positive' : 'negative');
        }

        // Update 24h volume
        const volumeEl = document.getElementById('volume-24h');
        if (volumeEl) {
            volumeEl.textContent = Utils.formatUSD(ticker.volume, true);
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        console.log('📊 Loading initial data...');

        // Load chart data
        await chartManager.loadHistoricalData(this.currentSymbol, this.currentTimeframe);

        // Load order book
        const orderbook = await apiManager.getBinanceOrderBook(this.currentSymbol);
        if (orderbook) {
            orderbookManager.update({
                exchange: 'binance',
                symbol: this.currentSymbol,
                ...orderbook,
                timestamp: Date.now()
            });
        }

        // Load ticker data
        const ticker = await apiManager.getBinanceTicker(this.currentSymbol);
        if (ticker) {
            this.updateTopBar({
                exchange: 'binance',
                symbol: this.currentSymbol,
                price: parseFloat(ticker.lastPrice),
                change: parseFloat(ticker.priceChangePercent),
                volume: parseFloat(ticker.volume)
            });
        }

        // Load funding rate
        const funding = await apiManager.getBinanceFunding(this.currentSymbol);
        if (funding) {
            const fundingEl = document.getElementById('funding-rate');
            if (fundingEl) {
                fundingEl.textContent = Utils.formatPercent(parseFloat(funding.fundingRate) * 100, 4);
            }
        }

        // Load open interest
        const oi = await apiManager.getBinanceOpenInterest(this.currentSymbol);
        if (oi) {
            const oiEl = document.getElementById('open-interest');
            if (oiEl) {
                oiEl.textContent = Utils.formatUSD(parseFloat(oi.openInterest) * parseFloat(oi.markPrice), true);
            }
        }
    }

    /**
     * Start periodic data updates
     */
    startDataUpdates() {
        // Update every 5 seconds
        this.updateInterval = setInterval(async () => {
            // Refresh funding rate
            const funding = await apiManager.getBinanceFunding(this.currentSymbol);
            if (funding) {
                const fundingEl = document.getElementById('funding-rate');
                if (fundingEl) {
                    fundingEl.textContent = Utils.formatPercent(parseFloat(funding.fundingRate) * 100, 4);
                }
            }

            // Refresh open interest
            const oi = await apiManager.getBinanceOpenInterest(this.currentSymbol);
            if (oi) {
                const oiEl = document.getElementById('open-interest');
                if (oiEl) {
                    oiEl.textContent = Utils.formatUSD(parseFloat(oi.openInterest) * parseFloat(oi.markPrice), true);
                }
            }
        }, 5000);

        // Simulate liquidations for demo (remove in production)
        if (!FEATURES.COINGLASS_LIQUIDATIONS) {
            setInterval(() => {
                if (Math.random() > 0.7) { // 30% chance every 5 seconds
                    liquidationManager.simulateLiquidation();
                }
            }, 5000);
        }
    }

    /**
     * Change symbol
     */
    async changeSymbol(symbol) {
        if (symbol === this.currentSymbol) return;

        console.log(`🔄 Changing symbol to ${symbol}`);
        this.showLoading();

        // Disconnect old WebSockets
        CONFIG.EXCHANGES.forEach(exchange => {
            wsManager.disconnect(exchange, this.currentSymbol);
        });

        // Update current symbol
        this.currentSymbol = symbol;

        // Clear data
        chartManager.clear();
        orderbookManager.clear();
        metricsManager.reset();

        // Reconnect WebSockets
        CONFIG.EXCHANGES.forEach(exchange => {
            wsManager.connect(exchange, symbol);
        });

        // Reload data
        await this.loadInitialData();

        this.hideLoading();
        Utils.showToast(`Switched to ${symbol}`, 'success');
    }

    /**
     * Change timeframe
     */
    async changeTimeframe(timeframe) {
        if (timeframe === this.currentTimeframe) return;

        console.log(`🔄 Changing timeframe to ${timeframe}`);
        this.currentTimeframe = timeframe;

        // Reload chart data
        await chartManager.loadHistoricalData(this.currentSymbol, timeframe);
    }

    /**
     * Export data
     */
    exportData() {
        const data = {
            symbol: this.currentSymbol,
            timeframe: this.currentTimeframe,
            timestamp: Date.now(),
            metrics: metricsManager.getSummary(),
            liquidations: liquidationManager.getSummary()
        };

        const filename = `cryptovault_${this.currentSymbol}_${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);

        Utils.showToast('Data exported', 'success');
    }

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            coinglassKey: document.getElementById('coinglass-key')?.value,
            telegramToken: document.getElementById('telegram-token')?.value,
            telegramChat: document.getElementById('telegram-chat')?.value,
            showGrid: document.getElementById('show-grid')?.checked,
            showVolume: document.getElementById('show-volume')?.checked,
            showCVD: document.getElementById('show-cvd')?.checked,
            autoScale: document.getElementById('auto-scale')?.checked
        };

        Utils.setLocalStorage(CONFIG.STORAGE.SETTINGS, settings);

        // Apply settings
        if (settings.coinglassKey) {
            CONFIG.API.COINGLASS.API_KEY = settings.coinglassKey;
        }
        if (settings.telegramToken) {
            CONFIG.ALERTS.TELEGRAM.BOT_TOKEN = settings.telegramToken;
            CONFIG.ALERTS.TELEGRAM.ENABLED = true;
        }
        if (settings.telegramChat) {
            CONFIG.ALERTS.TELEGRAM.CHAT_ID = settings.telegramChat;
        }
    }

    /**
     * Load settings
     */
    loadSettings() {
        const settings = Utils.getLocalStorage(CONFIG.STORAGE.SETTINGS, {});

        if (settings.coinglassKey) {
            document.getElementById('coinglass-key').value = settings.coinglassKey;
            CONFIG.API.COINGLASS.API_KEY = settings.coinglassKey;
        }
        if (settings.telegramToken) {
            document.getElementById('telegram-token').value = settings.telegramToken;
            CONFIG.ALERTS.TELEGRAM.BOT_TOKEN = settings.telegramToken;
        }
        if (settings.telegramChat) {
            document.getElementById('telegram-chat').value = settings.telegramChat;
            CONFIG.ALERTS.TELEGRAM.CHAT_ID = settings.telegramChat;
        }
        if (settings.showGrid !== undefined) {
            document.getElementById('show-grid').checked = settings.showGrid;
        }
        if (settings.showVolume !== undefined) {
            document.getElementById('show-volume').checked = settings.showVolume;
        }
        if (settings.showCVD !== undefined) {
            document.getElementById('show-cvd').checked = settings.showCVD;
        }
        if (settings.autoScale !== undefined) {
            document.getElementById('auto-scale').checked = settings.autoScale;
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 500);
        }
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        console.log('🧹 Cleaning up...');

        // Disconnect all WebSockets
        wsManager.disconnectAll();
        wsManager.stopPingInterval();

        // Clear intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Save session
        Utils.saveSession({
            symbol: this.currentSymbol,
            timeframe: this.currentTimeframe
        });
    }
}

// Create and initialize dashboard
const dashboard = new TradingDashboard();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dashboard.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    dashboard.cleanup();
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🌙 Dashboard hidden - pausing updates');
    } else {
        console.log('☀️ Dashboard visible - resuming updates');
    }
});
