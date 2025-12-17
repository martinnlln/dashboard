/**
 * Utility Functions
 * =================
 */

const Utils = {
    /**
     * Format number with abbreviation (K, M, B)
     */
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined) return '--';
        
        const absNum = Math.abs(num);
        if (absNum >= 1e9) {
            return (num / 1e9).toFixed(decimals) + 'B';
        }
        if (absNum >= 1e6) {
            return (num / 1e6).toFixed(decimals) + 'M';
        }
        if (absNum >= 1e3) {
            return (num / 1e3).toFixed(decimals) + 'K';
        }
        return num.toFixed(decimals);
    },

    /**
     * Format price with appropriate decimals
     */
    formatPrice(price, symbol = 'BTCUSDT') {
        if (price === null || price === undefined) return '--';
        
        const symbolConfig = CONFIG.SYMBOLS.find(s => s.symbol === symbol);
        const decimals = symbolConfig ? Math.abs(Math.log10(symbolConfig.tick)) : 2;
        
        return parseFloat(price).toFixed(decimals);
    },

    /**
     * Format USD amount
     */
    formatUSD(amount, compact = false) {
        if (amount === null || amount === undefined) return '--';
        
        if (compact) {
            return '$' + this.formatNumber(amount);
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    /**
     * Format percentage
     */
    formatPercent(value, decimals = 2) {
        if (value === null || value === undefined) return '--';
        const sign = value >= 0 ? '+' : '';
        return sign + value.toFixed(decimals) + '%';
    },

    /**
     * Format timestamp to time
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    },

    /**
     * Format timestamp to date and time
     */
    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    },

    /**
     * Calculate percentage change
     */
    calculateChange(current, previous) {
        if (!previous || previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    },

    /**
     * Throttle function execution
     */
    throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func(...args);
            }
        };
    },

    /**
     * Debounce function execution
     */
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    },

    /**
     * Generate random ID
     */
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    /**
     * Get color based on value
     */
    getValueColor(value) {
        if (value > 0) return CONFIG.COLORS.LONG;
        if (value < 0) return CONFIG.COLORS.SHORT;
        return CONFIG.COLORS.NEUTRAL;
    },

    /**
     * Interpolate color
     */
    interpolateColor(color1, color2, factor) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        
        return this.rgbToHex(r, g, b);
    },

    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * Convert RGB to hex
     */
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /**
     * Calculate order book imbalance
     */
    calculateImbalance(bids, asks) {
        const bidVolume = bids.reduce((sum, [_, qty]) => sum + parseFloat(qty), 0);
        const askVolume = asks.reduce((sum, [_, qty]) => sum + parseFloat(qty), 0);
        const total = bidVolume + askVolume;
        
        if (total === 0) return 50;
        
        return (bidVolume / total) * 100;
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">${type.toUpperCase()}</div>
            <div>${message}</div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Request browser notification permission
     */
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return Notification.permission === 'granted';
    },

    /**
     * Show browser notification
     */
    showNotification(title, body, icon = null) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: icon || CONFIG.ALERTS.BROWSER.ICON,
                badge: icon || CONFIG.ALERTS.BROWSER.ICON
            });
        }
    },

    /**
     * Play alert sound
     */
    playSound(soundType = 'liquidation') {
        if (!CONFIG.ALERTS.SOUND.ENABLED) return;
        
        const soundFile = CONFIG.ALERTS.SOUND.SOUNDS[soundType];
        if (soundFile) {
            const audio = new Audio(soundFile);
            audio.volume = CONFIG.ALERTS.SOUND.VOLUME;
            audio.play().catch(err => console.warn('Sound play failed:', err));
        }
    },

    /**
     * Export data to CSV
     */
    exportToCSV(data, filename) {
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Convert array of objects to CSV
     */
    convertToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const rows = data.map(obj => 
            headers.map(header => {
                const value = obj[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : value;
            }).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    },

    /**
     * Take screenshot of element
     */
    async takeScreenshot(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // For production, use html2canvas library
        this.showToast('Screenshot feature requires html2canvas library', 'info');
        
        // Placeholder implementation
        // const canvas = await html2canvas(element);
        // const link = document.createElement('a');
        // link.download = `screenshot_${Date.now()}.png`;
        // link.href = canvas.toDataURL();
        // link.click();
    },

    /**
     * Save session state
     */
    saveSession(state) {
        try {
            localStorage.setItem(CONFIG.STORAGE.SESSION, JSON.stringify({
                ...state,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error('Failed to save session:', err);
        }
    },

    /**
     * Load session state
     */
    loadSession() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE.SESSION);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Failed to load session:', err);
            return null;
        }
    },

    /**
     * Clear session state
     */
    clearSession() {
        try {
            localStorage.removeItem(CONFIG.STORAGE.SESSION);
        } catch (err) {
            console.error('Failed to clear session:', err);
        }
    },

    /**
     * Get local storage item
     */
    getLocalStorage(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (err) {
            console.error('Failed to get local storage:', err);
            return defaultValue;
        }
    },

    /**
     * Set local storage item
     */
    setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.error('Failed to set local storage:', err);
        }
    },

    /**
     * Calculate moving average
     */
    calculateMA(data, period) {
        if (data.length < period) return null;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    },

    /**
     * Calculate exponential moving average
     */
    calculateEMA(data, period) {
        if (data.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        return ema;
    },

    /**
     * Detect whale order (large order detection)
     */
    isWhaleOrder(size, price, threshold = CONFIG.DEFAULT.WHALE_THRESHOLD) {
        return (size * price) >= threshold;
    },

    /**
     * Format exchange name
     */
    formatExchange(exchange) {
        return exchange.charAt(0).toUpperCase() + exchange.slice(1);
    },

    /**
     * Get timeframe in milliseconds
     */
    getTimeframeMs(timeframe) {
        return CONFIG.TIMEFRAMES[timeframe]?.interval || 300000;
    },

    /**
     * Create gradient for canvas
     */
    createGradient(ctx, x1, y1, x2, y2, colorStops) {
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        colorStops.forEach(([offset, color]) => {
            gradient.addColorStop(offset, color);
        });
        return gradient;
    }
};

// Add CSS for toast slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlideOut {
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
