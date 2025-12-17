/**
 * Metrics Manager
 * ===============
 * Calculates and displays order flow metrics (CVD, Delta, etc.)
 */

class MetricsManager {
    constructor() {
        this.cvd = 0;
        this.cvdHistory = [];
        this.delta1m = 0;
        this.delta5m = 0;
        this.delta15m = 0;
        this.buyVolume = 0;
        this.sellVolume = 0;
        this.largeTrades = [];
        this.tradeSizeDistribution = {
            small: 0,   // < $10k
            medium: 0,  // $10k - $100k
            large: 0,   // $100k - $1M
            whale: 0    // > $1M
        };
        this.currentExchange = 'all';
        this.tradeHistory = {
            '1m': [],
            '5m': [],
            '15m': []
        };
    }

    /**
     * Initialize metrics manager
     */
    init() {
        this.setupExchangeTabs();
        this.initDistributionChart();
        
        // Update metrics every second
        setInterval(() => {
            this.updateMetricsDisplay();
        }, 1000);
        
        // Clean old trade history every minute
        setInterval(() => {
            this.cleanTradeHistory();
        }, 60000);
    }

    /**
     * Setup exchange tabs
     */
    setupExchangeTabs() {
        const tabs = document.querySelectorAll('.exchange-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentExchange = tab.dataset.exchange;
                this.updateMetricsDisplay();
            });
        });
    }

    /**
     * Process incoming trade
     */
    processTrade(trade) {
        // Filter by exchange if not 'all'
        if (this.currentExchange !== 'all' && trade.exchange !== this.currentExchange) {
            return;
        }

        const value = trade.price * trade.quantity;
        const delta = trade.side === 'buy' ? value : -value;

        // Update CVD
        this.cvd += delta;
        this.cvdHistory.push({
            timestamp: trade.timestamp,
            cvd: this.cvd
        });

        // Keep only last 1000 points
        if (this.cvdHistory.length > 1000) {
            this.cvdHistory = this.cvdHistory.slice(-1000);
        }

        // Update volume counters
        if (trade.side === 'buy') {
            this.buyVolume += value;
        } else {
            this.sellVolume += value;
        }

        // Add to trade history for delta calculations
        Object.keys(this.tradeHistory).forEach(timeframe => {
            this.tradeHistory[timeframe].push({
                timestamp: trade.timestamp,
                delta: delta,
                side: trade.side,
                value: value
            });
        });

        // Update delta values
        this.updateDeltas();

        // Check if it's a large trade
        if (value >= CONFIG.DEFAULT.WHALE_THRESHOLD) {
            this.addLargeTrade(trade);
        }

        // Update trade size distribution
        this.updateDistribution(value);

        // Update CVD chart
        this.updateCVDChart();
    }

    /**
     * Update delta values
     */
    updateDeltas() {
        const now = Date.now();
        
        // Calculate 1m delta
        this.delta1m = this.calculateDelta(this.tradeHistory['1m'], now - 60000);
        
        // Calculate 5m delta
        this.delta5m = this.calculateDelta(this.tradeHistory['5m'], now - 300000);
        
        // Calculate 15m delta
        this.delta15m = this.calculateDelta(this.tradeHistory['15m'], now - 900000);
    }

    /**
     * Calculate delta for timeframe
     */
    calculateDelta(trades, startTime) {
        return trades
            .filter(t => t.timestamp >= startTime)
            .reduce((sum, t) => sum + t.delta, 0);
    }

    /**
     * Clean old trade history
     */
    cleanTradeHistory() {
        const now = Date.now();
        
        // Keep only last 15 minutes
        Object.keys(this.tradeHistory).forEach(timeframe => {
            const cutoff = now - (15 * 60 * 1000);
            this.tradeHistory[timeframe] = this.tradeHistory[timeframe].filter(
                t => t.timestamp >= cutoff
            );
        });
    }

    /**
     * Add large trade to feed
     */
    addLargeTrade(trade) {
        this.largeTrades.unshift({
            ...trade,
            value: trade.price * trade.quantity
        });

        // Keep only last 50 trades
        if (this.largeTrades.length > 50) {
            this.largeTrades = this.largeTrades.slice(0, 50);
        }

        this.renderLargeTrades();
    }

    /**
     * Render large trades feed
     */
    renderLargeTrades() {
        const container = document.getElementById('large-trades-feed');
        if (!container) return;

        const html = this.largeTrades.slice(0, 20).map(trade => {
            const sideClass = trade.side === 'buy' ? 'buy' : 'sell';
            return `
                <div class="trade-item ${sideClass}">
                    <div>
                        <span style="font-weight: 700;">${trade.side.toUpperCase()}</span>
                        <span style="margin-left: 8px; color: var(--text-secondary);">${Utils.formatTime(trade.timestamp)}</span>
                    </div>
                    <div>
                        <span class="trade-size">${Utils.formatUSD(trade.value, true)}</span>
                        <span style="margin-left: 8px; color: var(--text-secondary);">@ ${Utils.formatPrice(trade.price)}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html || '<div style="color: var(--text-muted); font-size: 11px;">No large trades yet</div>';
    }

    /**
     * Update trade size distribution
     */
    updateDistribution(value) {
        if (value < 10000) {
            this.tradeSizeDistribution.small++;
        } else if (value < 100000) {
            this.tradeSizeDistribution.medium++;
        } else if (value < 1000000) {
            this.tradeSizeDistribution.large++;
        } else {
            this.tradeSizeDistribution.whale++;
        }

        // Update chart every 10 trades
        const total = Object.values(this.tradeSizeDistribution).reduce((a, b) => a + b, 0);
        if (total % 10 === 0) {
            this.renderDistributionChart();
        }
    }

    /**
     * Initialize distribution chart
     */
    initDistributionChart() {
        const canvas = document.getElementById('distribution-chart');
        if (!canvas) return;

        // Initial render
        this.renderDistributionChart();
    }

    /**
     * Render distribution chart
     */
    renderDistributionChart() {
        const canvas = document.getElementById('distribution-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.clientWidth;
        const height = 120;
        
        canvas.width = width;
        canvas.height = height;

        const dist = this.tradeSizeDistribution;
        const total = dist.small + dist.medium + dist.large + dist.whale;
        
        if (total === 0) return;

        const data = [
            { label: 'Small (<$10K)', value: dist.small, color: CONFIG.COLORS.NEUTRAL },
            { label: 'Medium ($10K-$100K)', value: dist.medium, color: CONFIG.COLORS.LONG },
            { label: 'Large ($100K-$1M)', value: dist.large, color: CONFIG.COLORS.SHORT },
            { label: 'Whale (>$1M)', value: dist.whale, color: CONFIG.COLORS.AMBER }
        ];

        // Clear canvas
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, width, height);

        // Draw bars
        const barWidth = width / data.length;
        const maxValue = Math.max(...data.map(d => d.value), 1);

        data.forEach((item, i) => {
            const barHeight = (item.value / maxValue) * (height - 40);
            const x = i * barWidth;
            const y = height - barHeight - 20;

            // Draw bar
            ctx.fillStyle = item.color + '80';
            ctx.fillRect(x + 10, y, barWidth - 20, barHeight);

            // Draw label
            ctx.fillStyle = CONFIG.COLORS.NEUTRAL;
            ctx.font = '10px ' + CONFIG.CHART.LAYOUT.fontFamily;
            ctx.textAlign = 'center';
            ctx.fillText(
                item.label,
                x + barWidth / 2,
                height - 5
            );

            // Draw value
            const percent = ((item.value / total) * 100).toFixed(1);
            ctx.fillStyle = CONFIG.COLORS.PRIMARY;
            ctx.fillText(
                percent + '%',
                x + barWidth / 2,
                y - 5
            );
        });
    }

    /**
     * Update metrics display
     */
    updateMetricsDisplay() {
        // Update CVD
        const cvdEl = document.getElementById('cvd-value');
        if (cvdEl) {
            const cvdFormatted = Utils.formatNumber(this.cvd);
            const cvdClass = this.cvd > 0 ? 'positive' : this.cvd < 0 ? 'negative' : '';
            cvdEl.textContent = cvdFormatted;
            cvdEl.className = 'metric-box-value ' + cvdClass;
        }

        // Update deltas
        this.updateDeltaDisplay('delta-1m', this.delta1m);
        this.updateDeltaDisplay('delta-5m', this.delta5m);
        this.updateDeltaDisplay('delta-15m', this.delta15m);

        // Update pressure bars
        this.updatePressureBars();

        // Update sparkline
        this.updateSparkline();
    }

    /**
     * Update delta display
     */
    updateDeltaDisplay(elementId, value) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const formatted = Utils.formatNumber(value);
        const className = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
        el.textContent = formatted;
        el.className = 'metric-box-value ' + className;
    }

    /**
     * Update pressure bars
     */
    updatePressureBars() {
        const total = this.buyVolume + this.sellVolume;
        if (total === 0) return;

        const buyPercent = (this.buyVolume / total) * 100;
        const sellPercent = (this.sellVolume / total) * 100;

        const buyBar = document.getElementById('buy-pressure');
        const sellBar = document.getElementById('sell-pressure');

        if (buyBar) {
            buyBar.style.width = buyPercent + '%';
        }
        if (sellBar) {
            sellBar.style.width = sellPercent + '%';
        }
    }

    /**
     * Update CVD sparkline
     */
    updateSparkline() {
        const container = document.getElementById('cvd-sparkline');
        if (!container || this.cvdHistory.length < 2) return;

        const width = container.clientWidth;
        const height = 30;

        // Create or get canvas
        let canvas = container.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            container.appendChild(canvas);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        
        // Clear
        ctx.clearRect(0, 0, width, height);

        // Get data
        const data = this.cvdHistory.slice(-50).map(p => p.cvd);
        const maxVal = Math.max(...data);
        const minVal = Math.min(...data);
        const range = maxVal - minVal || 1;

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = CONFIG.COLORS.NEUTRAL;
        ctx.lineWidth = 2;

        data.forEach((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((value - minVal) / range) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    /**
     * Update CVD chart
     */
    updateCVDChart() {
        if (chartManager.cvdSeries) {
            chartManager.updateCVD(this.cvdHistory);
        }
    }

    /**
     * Get current metrics summary
     */
    getSummary() {
        return {
            cvd: this.cvd,
            delta1m: this.delta1m,
            delta5m: this.delta5m,
            delta15m: this.delta15m,
            buyVolume: this.buyVolume,
            sellVolume: this.sellVolume,
            buyPressure: this.buyVolume / (this.buyVolume + this.sellVolume || 1),
            sellPressure: this.sellVolume / (this.buyVolume + this.sellVolume || 1),
            largeTrades: this.largeTrades.length,
            distribution: this.tradeSizeDistribution
        };
    }

    /**
     * Reset metrics
     */
    reset() {
        this.cvd = 0;
        this.cvdHistory = [];
        this.delta1m = 0;
        this.delta5m = 0;
        this.delta15m = 0;
        this.buyVolume = 0;
        this.sellVolume = 0;
        this.largeTrades = [];
        this.tradeSizeDistribution = {
            small: 0,
            medium: 0,
            large: 0,
            whale: 0
        };
        this.tradeHistory = {
            '1m': [],
            '5m': [],
            '15m': []
        };
        this.updateMetricsDisplay();
    }
}

// Create global instance
const metricsManager = new MetricsManager();
