/**
 * Pattern Recognition System
 * ===========================
 * Detects chart patterns and formations
 */

class PatternRecognition {
    constructor() {
        this.detectedPatterns = [];
        this.supportResistance = [];
    }

    /**
     * Detect all patterns in candle data
     */
    detectAllPatterns(candles) {
        if (candles.length < 50) return [];

        const patterns = [];

        // Chart patterns
        patterns.push(...this.detectHeadAndShoulders(candles));
        patterns.push(...this.detectDoubleTop(candles));
        patterns.push(...this.detectDoubleBottom(candles));
        patterns.push(...this.detectTriangles(candles));
        patterns.push(...this.detectFlags(candles));
        patterns.push(...this.detectWedges(candles));
        
        // Candlestick patterns
        patterns.push(...this.detectCandlestickPatterns(candles.slice(-10)));
        
        // Support/Resistance
        this.supportResistance = this.detectSupportResistance(candles);

        this.detectedPatterns = patterns;
        return patterns;
    }

    /**
     * Detect Head and Shoulders pattern
     */
    detectHeadAndShoulders(candles) {
        const patterns = [];
        const window = 40;

        for (let i = window; i < candles.length - 10; i++) {
            const subset = candles.slice(i - window, i);
            const highs = subset.map(c => c.high);
            
            // Find three peaks
            const peaks = this.findPeaks(highs);
            
            if (peaks.length >= 3) {
                const [shoulder1, head, shoulder2] = peaks.slice(-3);
                
                // Check if middle peak is highest (head)
                if (head.value > shoulder1.value && 
                    head.value > shoulder2.value &&
                    Math.abs(shoulder1.value - shoulder2.value) / shoulder1.value < 0.02) {
                    
                    patterns.push({
                        type: 'HEAD_AND_SHOULDERS',
                        direction: 'BEARISH',
                        confidence: 0.75,
                        startIndex: i - window + shoulder1.index,
                        endIndex: i - window + shoulder2.index,
                        neckline: Math.min(shoulder1.value, shoulder2.value),
                        target: head.value - (head.value - Math.min(shoulder1.value, shoulder2.value)) * 2,
                        timestamp: candles[i].timestamp
                    });
                }
            }
        }

        return patterns.slice(-1); // Return most recent
    }

    /**
     * Detect Double Top pattern
     */
    detectDoubleTop(candles) {
        const patterns = [];
        const window = 30;

        for (let i = window; i < candles.length - 5; i++) {
            const subset = candles.slice(i - window, i);
            const highs = subset.map(c => c.high);
            
            const peaks = this.findPeaks(highs);
            
            if (peaks.length >= 2) {
                const [peak1, peak2] = peaks.slice(-2);
                
                // Check if peaks are similar height
                if (Math.abs(peak1.value - peak2.value) / peak1.value < 0.015 &&
                    peak2.index - peak1.index > 10) {
                    
                    patterns.push({
                        type: 'DOUBLE_TOP',
                        direction: 'BEARISH',
                        confidence: 0.70,
                        level: (peak1.value + peak2.value) / 2,
                        target: peak1.value - (peak1.value - Math.min(...highs)) * 2,
                        timestamp: candles[i].timestamp
                    });
                }
            }
        }

        return patterns.slice(-1);
    }

    /**
     * Detect Double Bottom pattern
     */
    detectDoubleBottom(candles) {
        const patterns = [];
        const window = 30;

        for (let i = window; i < candles.length - 5; i++) {
            const subset = candles.slice(i - window, i);
            const lows = subset.map(c => c.low);
            
            const troughs = this.findTroughs(lows);
            
            if (troughs.length >= 2) {
                const [trough1, trough2] = troughs.slice(-2);
                
                if (Math.abs(trough1.value - trough2.value) / trough1.value < 0.015 &&
                    trough2.index - trough1.index > 10) {
                    
                    patterns.push({
                        type: 'DOUBLE_BOTTOM',
                        direction: 'BULLISH',
                        confidence: 0.70,
                        level: (trough1.value + trough2.value) / 2,
                        target: trough1.value + (Math.max(...lows) - trough1.value) * 2,
                        timestamp: candles[i].timestamp
                    });
                }
            }
        }

        return patterns.slice(-1);
    }

    /**
     * Detect Triangle patterns (Ascending, Descending, Symmetric)
     */
    detectTriangles(candles) {
        const patterns = [];
        const window = 40;

        if (candles.length < window) return patterns;

        const subset = candles.slice(-window);
        const highs = subset.map(c => c.high);
        const lows = subset.map(c => c.low);

        // Calculate trendlines
        const upperTrend = this.calculateTrendline(highs);
        const lowerTrend = this.calculateTrendline(lows);

        // Ascending Triangle: flat resistance, rising support
        if (Math.abs(upperTrend.slope) < 0.0001 && lowerTrend.slope > 0.001) {
            patterns.push({
                type: 'ASCENDING_TRIANGLE',
                direction: 'BULLISH',
                confidence: 0.65,
                resistance: upperTrend.intercept,
                target: upperTrend.intercept * 1.05,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        // Descending Triangle: falling resistance, flat support
        if (upperTrend.slope < -0.001 && Math.abs(lowerTrend.slope) < 0.0001) {
            patterns.push({
                type: 'DESCENDING_TRIANGLE',
                direction: 'BEARISH',
                confidence: 0.65,
                support: lowerTrend.intercept,
                target: lowerTrend.intercept * 0.95,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        // Symmetric Triangle: converging lines
        if (upperTrend.slope < -0.0005 && lowerTrend.slope > 0.0005) {
            patterns.push({
                type: 'SYMMETRIC_TRIANGLE',
                direction: 'NEUTRAL',
                confidence: 0.60,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        return patterns;
    }

    /**
     * Detect Flag and Pennant patterns
     */
    detectFlags(candles) {
        const patterns = [];
        const window = 20;

        if (candles.length < window * 2) return patterns;

        // Look for strong move followed by consolidation
        const recentCandles = candles.slice(-window);
        const priorCandles = candles.slice(-window * 2, -window);

        const recentRange = Math.max(...recentCandles.map(c => c.high)) - 
                           Math.min(...recentCandles.map(c => c.low));
        const priorMove = priorCandles[priorCandles.length - 1].close - priorCandles[0].close;
        const priorRange = Math.max(...priorCandles.map(c => c.high)) - 
                          Math.min(...priorCandles.map(c => c.low));

        // Bull Flag: strong up move + consolidation
        if (priorMove > priorRange * 0.5 && recentRange < priorRange * 0.3) {
            patterns.push({
                type: 'BULL_FLAG',
                direction: 'BULLISH',
                confidence: 0.70,
                poleHeight: priorMove,
                target: recentCandles[recentCandles.length - 1].close + priorMove,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        // Bear Flag: strong down move + consolidation
        if (priorMove < -priorRange * 0.5 && recentRange < priorRange * 0.3) {
            patterns.push({
                type: 'BEAR_FLAG',
                direction: 'BEARISH',
                confidence: 0.70,
                poleHeight: priorMove,
                target: recentCandles[recentCandles.length - 1].close + priorMove,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        return patterns;
    }

    /**
     * Detect Wedge patterns
     */
    detectWedges(candles) {
        const patterns = [];
        const window = 40;

        if (candles.length < window) return patterns;

        const subset = candles.slice(-window);
        const highs = subset.map(c => c.high);
        const lows = subset.map(c => c.low);

        const upperTrend = this.calculateTrendline(highs);
        const lowerTrend = this.calculateTrendline(lows);

        // Rising Wedge: both lines rising, bearish
        if (upperTrend.slope > 0 && lowerTrend.slope > 0 && 
            lowerTrend.slope > upperTrend.slope) {
            patterns.push({
                type: 'RISING_WEDGE',
                direction: 'BEARISH',
                confidence: 0.65,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        // Falling Wedge: both lines falling, bullish
        if (upperTrend.slope < 0 && lowerTrend.slope < 0 && 
            upperTrend.slope < lowerTrend.slope) {
            patterns.push({
                type: 'FALLING_WEDGE',
                direction: 'BULLISH',
                confidence: 0.65,
                timestamp: candles[candles.length - 1].timestamp
            });
        }

        return patterns;
    }

    /**
     * Detect candlestick patterns
     */
    detectCandlestickPatterns(candles) {
        const patterns = [];
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];

        if (!last || !prev) return patterns;

        const bodySize = Math.abs(last.close - last.open);
        const wickUp = last.high - Math.max(last.open, last.close);
        const wickDown = Math.min(last.open, last.close) - last.low;
        const range = last.high - last.low;

        // Hammer / Hanging Man
        if (wickDown > bodySize * 2 && wickUp < bodySize * 0.3) {
            patterns.push({
                type: last.close > prev.close ? 'HAMMER' : 'HANGING_MAN',
                direction: last.close > prev.close ? 'BULLISH' : 'BEARISH',
                confidence: 0.60,
                timestamp: last.timestamp
            });
        }

        // Shooting Star / Inverted Hammer
        if (wickUp > bodySize * 2 && wickDown < bodySize * 0.3) {
            patterns.push({
                type: last.close < prev.close ? 'SHOOTING_STAR' : 'INVERTED_HAMMER',
                direction: last.close < prev.close ? 'BEARISH' : 'BULLISH',
                confidence: 0.60,
                timestamp: last.timestamp
            });
        }

        // Doji
        if (bodySize < range * 0.1) {
            patterns.push({
                type: 'DOJI',
                direction: 'NEUTRAL',
                confidence: 0.50,
                timestamp: last.timestamp
            });
        }

        // Engulfing
        const prevBody = Math.abs(prev.close - prev.open);
        if (bodySize > prevBody * 1.5) {
            if (last.close > last.open && prev.close < prev.open) {
                patterns.push({
                    type: 'BULLISH_ENGULFING',
                    direction: 'BULLISH',
                    confidence: 0.70,
                    timestamp: last.timestamp
                });
            } else if (last.close < last.open && prev.close > prev.open) {
                patterns.push({
                    type: 'BEARISH_ENGULFING',
                    direction: 'BEARISH',
                    confidence: 0.70,
                    timestamp: last.timestamp
                });
            }
        }

        return patterns;
    }

    /**
     * Detect Support and Resistance levels
     */
    detectSupportResistance(candles, touchThreshold = 3) {
        const levels = [];
        const pricePoints = [];

        // Collect significant price points
        candles.forEach(candle => {
            pricePoints.push(candle.high);
            pricePoints.push(candle.low);
        });

        // Cluster similar prices
        const clusters = this.clusterPrices(pricePoints, 0.005); // 0.5% tolerance

        // Filter by number of touches
        clusters.forEach(cluster => {
            if (cluster.count >= touchThreshold) {
                const level = {
                    price: cluster.price,
                    strength: cluster.count,
                    type: this.determineLevelType(cluster.price, candles),
                    touches: cluster.count
                };
                levels.push(level);
            }
        });

        return levels.sort((a, b) => b.strength - a.strength).slice(0, 10);
    }

    /**
     * Helper: Find peaks in data
     */
    findPeaks(data, period = 5) {
        const peaks = [];
        for (let i = period; i < data.length - period; i++) {
            let isPeak = true;
            for (let j = i - period; j <= i + period; j++) {
                if (j !== i && data[j] >= data[i]) {
                    isPeak = false;
                    break;
                }
            }
            if (isPeak) {
                peaks.push({ index: i, value: data[i] });
            }
        }
        return peaks;
    }

    /**
     * Helper: Find troughs in data
     */
    findTroughs(data, period = 5) {
        const troughs = [];
        for (let i = period; i < data.length - period; i++) {
            let isTrough = true;
            for (let j = i - period; j <= i + period; j++) {
                if (j !== i && data[j] <= data[i]) {
                    isTrough = false;
                    break;
                }
            }
            if (isTrough) {
                troughs.push({ index: i, value: data[i] });
            }
        }
        return troughs;
    }

    /**
     * Helper: Calculate trendline
     */
    calculateTrendline(data) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumXX += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
    }

    /**
     * Helper: Cluster similar prices
     */
    clusterPrices(prices, tolerance) {
        const clusters = [];
        const sorted = [...prices].sort((a, b) => a - b);

        let currentCluster = { price: sorted[0], count: 1, prices: [sorted[0]] };

        for (let i = 1; i < sorted.length; i++) {
            if ((sorted[i] - currentCluster.price) / currentCluster.price <= tolerance) {
                currentCluster.count++;
                currentCluster.prices.push(sorted[i]);
                currentCluster.price = currentCluster.prices.reduce((a, b) => a + b) / currentCluster.prices.length;
            } else {
                clusters.push(currentCluster);
                currentCluster = { price: sorted[i], count: 1, prices: [sorted[i]] };
            }
        }
        clusters.push(currentCluster);

        return clusters;
    }

    /**
     * Helper: Determine if level is support or resistance
     */
    determineLevelType(price, candles) {
        const currentPrice = candles[candles.length - 1].close;
        return price < currentPrice ? 'SUPPORT' : 'RESISTANCE';
    }

    /**
     * Get pattern summary for UI
     */
    getPatternSummary() {
        return {
            total: this.detectedPatterns.length,
            bullish: this.detectedPatterns.filter(p => p.direction === 'BULLISH').length,
            bearish: this.detectedPatterns.filter(p => p.direction === 'BEARISH').length,
            patterns: this.detectedPatterns,
            supportResistance: this.supportResistance
        };
    }
}

// Create global instance
const patternRecognition = new PatternRecognition();
