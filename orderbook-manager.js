/**
 * Order Book Manager
 * ==================
 * Manages real-time order book visualization
 */

class OrderBookManager {
    constructor() {
        this.orderbook = {
            bids: [],
            asks: []
        };
        this.depth = CONFIG.DEFAULT.ORDERBOOK_DEPTH;
        this.whaleSizeThreshold = CONFIG.DEFAULT.WHALE_THRESHOLD;
        this.updateThrottle = Utils.throttle(
            this.render.bind(this), 
            CONFIG.PERFORMANCE.ORDERBOOK_UPDATE_THROTTLE
        );
    }

    /**
     * Initialize order book
     */
    init() {
        // Set up depth selector
        const depthSelect = document.getElementById('orderbook-depth');
        if (depthSelect) {
            depthSelect.addEventListener('change', (e) => {
                this.depth = parseInt(e.target.value);
                this.render();
            });
        }
    }

    /**
     * Update order book data
     */
    update(data) {
        this.orderbook = {
            bids: data.bids.slice(0, this.depth),
            asks: data.asks.slice(0, this.depth)
        };

        this.updateThrottle();
    }

    /**
     * Render order book
     */
    render() {
        this.renderBids();
        this.renderAsks();
        this.updateImbalance();
        this.updateSpread();
        this.detectWhaleWalls();
    }

    /**
     * Render bid orders
     */
    renderBids() {
        const container = document.getElementById('orderbook-bids');
        if (!container) return;

        const maxVolume = this.getMaxVolume();
        let cumulativeTotal = 0;

        const html = this.orderbook.bids.map(([price, qty]) => {
            cumulativeTotal += parseFloat(qty);
            const total = cumulativeTotal;
            const depthPercent = (total / maxVolume) * 100;

            return `
                <div class="orderbook-row bid" style="--depth-width: ${depthPercent}%">
                    <span>${Utils.formatPrice(price, this.currentSymbol)}</span>
                    <span>${Utils.formatNumber(qty, 4)}</span>
                    <span>${Utils.formatNumber(total, 4)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Render ask orders
     */
    renderAsks() {
        const container = document.getElementById('orderbook-asks');
        if (!container) return;

        const maxVolume = this.getMaxVolume();
        let cumulativeTotal = 0;

        // Reverse asks to show highest price at top
        const reversedAsks = [...this.orderbook.asks].reverse();

        const html = reversedAsks.map(([price, qty]) => {
            cumulativeTotal += parseFloat(qty);
            const total = cumulativeTotal;
            const depthPercent = (total / maxVolume) * 100;

            return `
                <div class="orderbook-row ask" style="--depth-width: ${depthPercent}%">
                    <span>${Utils.formatPrice(price, this.currentSymbol)}</span>
                    <span>${Utils.formatNumber(qty, 4)}</span>
                    <span>${Utils.formatNumber(total, 4)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Get maximum volume for depth visualization
     */
    getMaxVolume() {
        const bidVolumes = this.orderbook.bids.map(([_, qty]) => parseFloat(qty));
        const askVolumes = this.orderbook.asks.map(([_, qty]) => parseFloat(qty));
        return Math.max(...bidVolumes, ...askVolumes, 0);
    }

    /**
     * Update order book imbalance gauge
     */
    updateImbalance() {
        const imbalance = Utils.calculateImbalance(
            this.orderbook.bids,
            this.orderbook.asks
        );

        const fill = document.getElementById('imbalance-fill');
        const value = document.getElementById('imbalance-value');

        if (fill && value) {
            // Transform range: 0-100 to 0-100% position
            fill.style.transform = `translateX(${imbalance - 50}%)`;
            
            const bidPercent = imbalance.toFixed(1);
            const askPercent = (100 - imbalance).toFixed(1);
            value.textContent = `${bidPercent}/${askPercent}`;
        }
    }

    /**
     * Update spread display
     */
    updateSpread() {
        if (this.orderbook.bids.length === 0 || this.orderbook.asks.length === 0) {
            return;
        }

        const bestBid = parseFloat(this.orderbook.bids[0][0]);
        const bestAsk = parseFloat(this.orderbook.asks[0][0]);
        const spread = bestAsk - bestBid;
        const spreadPercent = (spread / bestBid) * 100;

        const spreadValue = document.getElementById('spread-value');
        if (spreadValue) {
            spreadValue.textContent = `${Utils.formatPrice(spread)} (${spreadPercent.toFixed(3)}%)`;
        }
    }

    /**
     * Detect whale walls (large orders)
     */
    detectWhaleWalls() {
        const whales = [];
        const currentPrice = this.getBestBid();

        // Check bids
        this.orderbook.bids.forEach(([price, qty]) => {
            const value = parseFloat(price) * parseFloat(qty);
            if (Utils.isWhaleOrder(qty, price, this.whaleSizeThreshold)) {
                whales.push({
                    side: 'bid',
                    price: parseFloat(price),
                    quantity: parseFloat(qty),
                    value: value,
                    distance: ((parseFloat(price) - currentPrice) / currentPrice) * 100
                });
            }
        });

        // Check asks
        this.orderbook.asks.forEach(([price, qty]) => {
            const value = parseFloat(price) * parseFloat(qty);
            if (Utils.isWhaleOrder(qty, price, this.whaleSizeThreshold)) {
                whales.push({
                    side: 'ask',
                    price: parseFloat(price),
                    quantity: parseFloat(qty),
                    value: value,
                    distance: ((parseFloat(price) - currentPrice) / currentPrice) * 100
                });
            }
        });

        this.renderWhaleWalls(whales);
    }

    /**
     * Render whale walls
     */
    renderWhaleWalls(whales) {
        const container = document.getElementById('whale-walls-list');
        if (!container) return;

        if (whales.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">No whale walls detected</div>';
            return;
        }

        const html = whales.map(whale => `
            <div class="whale-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 700; color: ${whale.side === 'bid' ? CONFIG.COLORS.LONG : CONFIG.COLORS.SHORT}">
                        ${whale.side.toUpperCase()}
                    </span>
                    <span style="color: var(--accent-amber); font-weight: 700;">
                        ${Utils.formatUSD(whale.value, true)}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                    <span>@ ${Utils.formatPrice(whale.price)}</span>
                    <span>${whale.distance > 0 ? '+' : ''}${whale.distance.toFixed(2)}%</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Get best bid price
     */
    getBestBid() {
        return this.orderbook.bids.length > 0 
            ? parseFloat(this.orderbook.bids[0][0]) 
            : 0;
    }

    /**
     * Get best ask price
     */
    getBestAsk() {
        return this.orderbook.asks.length > 0 
            ? parseFloat(this.orderbook.asks[0][0]) 
            : 0;
    }

    /**
     * Get mid price
     */
    getMidPrice() {
        const bid = this.getBestBid();
        const ask = this.getBestAsk();
        return (bid + ask) / 2;
    }

    /**
     * Clear order book
     */
    clear() {
        this.orderbook = {
            bids: [],
            asks: []
        };
        this.render();
    }
}

// Create global instance
const orderbookManager = new OrderBookManager();
