/**
 * Liquidation Manager
 * ===================
 * Tracks and displays liquidation data
 */

class LiquidationManager {
    constructor() {
        this.liquidations = [];
        this.longLiqTotal = 0;
        this.shortLiqTotal = 0;
        this.heatmapData = null;
        this.currentView = 'feed';
        this.maxFeedItems = CONFIG.DEFAULT.MAX_FEED_ITEMS;
    }

    /**
     * Initialize liquidation manager
     */
    init() {
        this.setupViewToggle();
        this.loadLiquidationData();
        
        // Refresh liquidation data every minute
        setInterval(() => {
            this.loadLiquidationData();
        }, 60000);
    }

    /**
     * Setup view toggle between feed and heatmap
     */
    setupViewToggle() {
        const buttons = document.querySelectorAll('.liquidation-panel .panel-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
    }

    /**
     * Switch between feed and heatmap view
     */
    switchView(view) {
        this.currentView = view;
        
        const feedEl = document.getElementById('liquidation-feed');
        const heatmapEl = document.getElementById('liquidation-heatmap');
        
        if (view === 'feed') {
            feedEl.classList.remove('hidden');
            heatmapEl.classList.add('hidden');
        } else {
            feedEl.classList.add('hidden');
            heatmapEl.classList.remove('hidden');
            this.renderHeatmap();
        }
    }

    /**
     * Load liquidation data from CoinGlass
     */
    async loadLiquidationData() {
        if (!FEATURES.COINGLASS_LIQUIDATIONS) return;

        try {
            const symbol = CONFIG.DEFAULT.SYMBOL.replace('USDT', '');
            const data = await apiManager.getLiquidations(symbol, '24h');
            
            if (data) {
                this.processLiquidationData(data);
                this.updateStats();
            }
        } catch (err) {
            console.error('Failed to load liquidation data:', err);
        }
    }

    /**
     * Process liquidation data
     */
    processLiquidationData(data) {
        // This is a placeholder - actual CoinGlass data structure may vary
        if (Array.isArray(data)) {
            this.liquidations = data.slice(0, this.maxFeedItems);
        }
    }

    /**
     * Add new liquidation (from WebSocket or simulation)
     */
    addLiquidation(liquidation) {
        // Add to beginning of array
        this.liquidations.unshift(liquidation);
        
        // Keep only max items
        if (this.liquidations.length > this.maxFeedItems) {
            this.liquidations = this.liquidations.slice(0, this.maxFeedItems);
        }

        // Update totals
        if (liquidation.side === 'long') {
            this.longLiqTotal += liquidation.amount;
        } else {
            this.shortLiqTotal += liquidation.amount;
        }

        // Render feed
        if (this.currentView === 'feed') {
            this.renderFeed();
        }

        // Update stats
        this.updateStats();

        // Check for cascade alert
        this.checkCascadeAlert(liquidation);

        // Add marker to chart
        chartManager.addLiquidationMarker(liquidation);
    }

    /**
     * Render liquidation feed
     */
    renderFeed() {
        const container = document.getElementById('liquidation-feed');
        if (!container) return;

        const html = this.liquidations.map(liq => {
            const sideClass = liq.side === 'long' ? 'long' : 'short';
            const sideLabel = liq.side === 'long' ? 'LONG' : 'SHORT';
            
            return `
                <div class="liq-item ${sideClass}">
                    <div class="liq-header">
                        <span class="liq-symbol">${liq.symbol}</span>
                        <span class="liq-type ${sideClass}">${sideLabel}</span>
                    </div>
                    <div class="liq-details">
                        <span class="liq-amount">${Utils.formatUSD(liq.amount, true)}</span>
                        <span>@ ${Utils.formatPrice(liq.price, liq.symbol)}</span>
                        <span>${Utils.formatTime(liq.timestamp)}</span>
                    </div>
                    ${liq.exchange ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${Utils.formatExchange(liq.exchange)}</div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Update liquidation stats
     */
    updateStats() {
        const longTotalEl = document.getElementById('long-liq-total');
        const shortTotalEl = document.getElementById('short-liq-total');

        if (longTotalEl) {
            longTotalEl.textContent = Utils.formatUSD(this.longLiqTotal, true);
        }
        if (shortTotalEl) {
            shortTotalEl.textContent = Utils.formatUSD(this.shortLiqTotal, true);
        }
    }

    /**
     * Render liquidation heatmap
     */
    async renderHeatmap() {
        const canvas = document.getElementById('heatmap-canvas');
        if (!canvas) return;

        // Load heatmap data if not already loaded
        if (!this.heatmapData) {
            const symbol = CONFIG.DEFAULT.SYMBOL.replace('USDT', '');
            this.heatmapData = await apiManager.getLiquidationHeatmap(symbol);
        }

        if (!this.heatmapData) {
            return;
        }

        // Render heatmap
        this.drawHeatmap(canvas, this.heatmapData);
    }

    /**
     * Draw heatmap on canvas
     */
    drawHeatmap(canvas, data) {
        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.clientWidth;
        const height = 400;
        
        canvas.width = width;
        canvas.height = height;

        // Clear canvas
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, width, height);

        // This is a placeholder for actual heatmap rendering
        // Real implementation would:
        // 1. Parse liquidation level data
        // 2. Create color gradient based on liquidation concentration
        // 3. Draw bars or heat rectangles at price levels
        
        ctx.fillStyle = CONFIG.COLORS.NEUTRAL;
        ctx.font = '14px ' + CONFIG.CHART.LAYOUT.fontFamily;
        ctx.textAlign = 'center';
        ctx.fillText('Liquidation Heatmap', width / 2, height / 2);
        ctx.fillText('(Requires CoinGlass API)', width / 2, height / 2 + 20);
    }

    /**
     * Check for liquidation cascade and alert
     */
    checkCascadeAlert(liquidation) {
        if (liquidation.amount >= CONFIG.DEFAULT.LIQUIDATION_THRESHOLD) {
            // Large liquidation detected
            const message = `💥 LARGE LIQUIDATION DETECTED\n${liquidation.side.toUpperCase()} ${Utils.formatUSD(liquidation.amount)}\n${liquidation.symbol} @ ${Utils.formatPrice(liquidation.price)}`;
            
            // Show browser notification
            if (CONFIG.ALERTS.BROWSER.ENABLED) {
                Utils.showNotification('Liquidation Alert', message);
            }

            // Play sound
            Utils.playSound('liquidation');

            // Send Telegram alert
            if (CONFIG.ALERTS.TELEGRAM.ENABLED) {
                apiManager.sendTelegramAlert(message);
            }

            // Toast notification
            Utils.showToast(message, 'warning', 5000);
        }
    }

    /**
     * Simulate liquidation (for testing)
     */
    simulateLiquidation() {
        const sides = ['long', 'short'];
        const side = sides[Math.floor(Math.random() * sides.length)];
        const amount = Math.random() * 5000000 + 100000; // $100K - $5M
        const price = orderbookManager.getMidPrice() * (Math.random() * 0.02 + 0.99); // ±1%

        this.addLiquidation({
            symbol: CONFIG.DEFAULT.SYMBOL,
            side: side,
            amount: amount,
            price: price,
            timestamp: Date.now(),
            exchange: 'binance'
        });
    }

    /**
     * Get liquidation summary
     */
    getSummary() {
        const total = this.longLiqTotal + this.shortLiqTotal;
        const longPercent = total > 0 ? (this.longLiqTotal / total) * 100 : 50;
        const shortPercent = 100 - longPercent;

        return {
            total,
            long: this.longLiqTotal,
            short: this.shortLiqTotal,
            longPercent,
            shortPercent,
            count: this.liquidations.length
        };
    }

    /**
     * Clear liquidation data
     */
    clear() {
        this.liquidations = [];
        this.longLiqTotal = 0;
        this.shortLiqTotal = 0;
        this.renderFeed();
        this.updateStats();
    }
}

// Create global instance
const liquidationManager = new LiquidationManager();
