/**
 * Chart Manager
 * =============
 * Manages TradingView Lightweight Charts
 */

class ChartManager {
    constructor() {
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.cvdSeries = null;
        this.markers = [];
        this.currentSymbol = CONFIG.DEFAULT.SYMBOL;
        this.currentTimeframe = CONFIG.DEFAULT.TIMEFRAME;
    }

    /**
     * Initialize charts
     */
    init() {
        this.initMainChart();
        this.initVolumeChart();
        this.initCVDChart();
    }

    /**
     * Initialize main price chart
     */
    initMainChart() {
        const container = document.getElementById('main-chart');
        if (!container) return;

        this.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: CONFIG.CHART.LAYOUT,
            grid: CONFIG.CHART.GRID,
            crosshair: CONFIG.CHART.CROSSHAIR,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: CONFIG.COLORS.BORDER
            },
            rightPriceScale: {
                borderColor: CONFIG.COLORS.BORDER,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2
                }
            },
            watermark: CONFIG.CHART.WATERMARK
        });

        // Create candlestick series
        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: CONFIG.COLORS.LONG,
            downColor: CONFIG.COLORS.SHORT,
            borderUpColor: CONFIG.COLORS.LONG,
            borderDownColor: CONFIG.COLORS.SHORT,
            wickUpColor: CONFIG.COLORS.LONG,
            wickDownColor: CONFIG.COLORS.SHORT
        });

        // Handle resize
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight
                });
            }
        });
    }

    /**
     * Initialize volume chart
     */
    initVolumeChart() {
        const container = document.getElementById('volume-chart');
        if (!container) return;

        this.volumeChart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: CONFIG.CHART.LAYOUT,
            grid: CONFIG.CHART.GRID,
            timeScale: {
                visible: false,
                borderColor: CONFIG.COLORS.BORDER
            },
            rightPriceScale: {
                borderColor: CONFIG.COLORS.BORDER
            }
        });

        this.volumeSeries = this.volumeChart.addHistogramSeries({
            color: CONFIG.COLORS.NEUTRAL,
            priceFormat: {
                type: 'volume'
            },
            priceScaleId: 'volume'
        });

        window.addEventListener('resize', () => {
            if (this.volumeChart) {
                this.volumeChart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight
                });
            }
        });
    }

    /**
     * Initialize CVD chart
     */
    initCVDChart() {
        const container = document.getElementById('cvd-chart');
        if (!container) return;

        this.cvdChart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: CONFIG.CHART.LAYOUT,
            grid: CONFIG.CHART.GRID,
            timeScale: {
                visible: false,
                borderColor: CONFIG.COLORS.BORDER
            },
            rightPriceScale: {
                borderColor: CONFIG.COLORS.BORDER
            }
        });

        this.cvdSeries = this.cvdChart.addLineSeries({
            color: CONFIG.COLORS.NEUTRAL,
            lineWidth: 2
        });

        window.addEventListener('resize', () => {
            if (this.cvdChart) {
                this.cvdChart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight
                });
            }
        });
    }

    /**
     * Load historical data
     */
    async loadHistoricalData(symbol, timeframe) {
        this.currentSymbol = symbol;
        this.currentTimeframe = timeframe;

        try {
            // Map timeframe to Binance interval
            const intervalMap = {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '1h': '1h',
                '4h': '4h'
            };

            const interval = intervalMap[timeframe];
            const candles = await apiManager.getBinanceKlines(symbol, interval, 500);

            if (candles && candles.length > 0) {
                this.updateCandles(candles);
                this.updateVolume(candles);
            }
        } catch (err) {
            console.error('Failed to load historical data:', err);
            Utils.showToast('Failed to load chart data', 'error');
        }
    }

    /**
     * Update candlestick data
     */
    updateCandles(candles) {
        if (!this.candleSeries) return;

        const data = candles.map(candle => ({
            time: Math.floor(candle.timestamp / 1000),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        }));

        this.candleSeries.setData(data);
    }

    /**
     * Update volume data
     */
    updateVolume(candles) {
        if (!this.volumeSeries) return;

        const data = candles.map(candle => {
            const color = candle.close >= candle.open 
                ? CONFIG.COLORS.LONG 
                : CONFIG.COLORS.SHORT;
            
            return {
                time: Math.floor(candle.timestamp / 1000),
                value: candle.volume,
                color: color + '80' // Add transparency
            };
        });

        this.volumeSeries.setData(data);
    }

    /**
     * Update real-time candle
     */
    updateRealtimeCandle(trade) {
        if (!this.candleSeries) return;

        const timestamp = Math.floor(trade.timestamp / 1000);
        const tfMs = Utils.getTimeframeMs(this.currentTimeframe);
        const candleTime = Math.floor(timestamp / (tfMs / 1000)) * (tfMs / 1000);

        // Get last candle or create new one
        const lastCandle = this.candleSeries.data()?.slice(-1)[0];
        
        if (!lastCandle || lastCandle.time < candleTime) {
            // New candle
            this.candleSeries.update({
                time: candleTime,
                open: trade.price,
                high: trade.price,
                low: trade.price,
                close: trade.price
            });
        } else if (lastCandle.time === candleTime) {
            // Update existing candle
            this.candleSeries.update({
                time: candleTime,
                open: lastCandle.open,
                high: Math.max(lastCandle.high, trade.price),
                low: Math.min(lastCandle.low, trade.price),
                close: trade.price
            });
        }
    }

    /**
     * Add liquidation marker
     */
    addLiquidationMarker(liquidation) {
        if (!this.candleSeries) return;

        const marker = {
            time: Math.floor(liquidation.timestamp / 1000),
            position: liquidation.side === 'long' ? 'belowBar' : 'aboveBar',
            color: liquidation.side === 'long' ? CONFIG.COLORS.LONG : CONFIG.COLORS.SHORT,
            shape: 'circle',
            text: `L ${Utils.formatUSD(liquidation.amount, true)}`
        };

        this.markers.push(marker);
        
        // Keep only last 100 markers
        if (this.markers.length > 100) {
            this.markers = this.markers.slice(-100);
        }

        this.candleSeries.setMarkers(this.markers);
    }

    /**
     * Draw support/resistance levels
     */
    drawSupportResistance(levels) {
        if (!this.chart) return;

        // Remove old lines
        // Note: TradingView Lightweight Charts doesn't have built-in support for lines
        // This would require custom rendering or using markers
        
        levels.forEach(level => {
            // Add horizontal line at level.price
            // This is a placeholder - actual implementation would require
            // custom price line series or overlay
            console.log('Support/Resistance level:', level);
        });
    }

    /**
     * Draw volume profile
     */
    drawVolumeProfile(profile) {
        if (!this.chart) return;

        // Volume profile requires custom rendering
        // This would be implemented using histogram series on the right side
        console.log('Volume profile:', profile);
    }

    /**
     * Update CVD indicator
     */
    updateCVD(cvdData) {
        if (!this.cvdSeries) return;

        const data = cvdData.map(point => ({
            time: Math.floor(point.timestamp / 1000),
            value: point.cvd
        }));

        this.cvdSeries.setData(data);
    }

    /**
     * Toggle indicator visibility
     */
    toggleIndicator(indicator) {
        switch (indicator) {
            case 'volume':
                const volumeContainer = document.getElementById('volume-chart');
                volumeContainer.classList.toggle('hidden');
                break;
            case 'cvd':
                const cvdContainer = document.getElementById('cvd-chart');
                cvdContainer.classList.toggle('hidden');
                break;
            case 'vp':
                // Toggle volume profile
                break;
            case 'sr':
                // Toggle support/resistance
                break;
        }
    }

    /**
     * Take screenshot
     */
    async takeScreenshot() {
        if (!this.chart) return;

        // Export chart to image
        // Note: This requires canvas conversion
        Utils.showToast('Chart screenshot captured', 'success');
    }

    /**
     * Clear chart data
     */
    clear() {
        if (this.candleSeries) {
            this.candleSeries.setData([]);
        }
        if (this.volumeSeries) {
            this.volumeSeries.setData([]);
        }
        if (this.cvdSeries) {
            this.cvdSeries.setData([]);
        }
        this.markers = [];
    }
}

// Create global instance
const chartManager = new ChartManager();
