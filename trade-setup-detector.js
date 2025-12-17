/**
 * Trade Setup Detector
 * ====================
 * Identifies high-probability trade setups using AI, TA, and patterns
 */

class TradeSetupDetector {
    constructor() {
        this.activeSetups = [];
        this.setupHistory = [];
        this.minConfidence = 0.60;
    }

    /**
     * Analyze current market and detect trade setups
     */
    async analyzeMarket(candles, indicators, patterns, prediction, regime) {
        const setups = [];
        const currentPrice = candles[candles.length - 1].close;
        const latestIndicator = indicators[indicators.length - 1];

        // Strategy 1: Trend Following with AI Confirmation
        const trendSetup = this.detectTrendFollowing(
            candles, latestIndicator, prediction, regime
        );
        if (trendSetup) setups.push(trendSetup);

        // Strategy 2: Mean Reversion
        const reversionSetup = this.detectMeanReversion(
            currentPrice, latestIndicator, patterns
        );
        if (reversionSetup) setups.push(reversionSetup);

        // Strategy 3: Breakout Trading
        const breakoutSetup = this.detectBreakout(
            candles, latestIndicator, patterns
        );
        if (breakoutSetup) setups.push(breakoutSetup);

        // Strategy 4: Pattern-Based Trading
        const patternSetup = this.detectPatternTrade(
            patterns, latestIndicator, prediction
        );
        if (patternSetup) setups.push(patternSetup);

        // Strategy 5: Divergence Trading
        const divergenceSetup = this.detectDivergenceTrade(
            candles, indicators
        );
        if (divergenceSetup) setups.push(divergenceSetup);

        // Filter by confidence threshold
        const validSetups = setups.filter(s => s.confidence >= this.minConfidence);

        // Sort by confidence
        validSetups.sort((a, b) => b.confidence - a.confidence);

        this.activeSetups = validSetups;
        return validSetups;
    }

    /**
     * Strategy 1: Trend Following with AI
     */
    detectTrendFollowing(candles, indicator, prediction, regime) {
        const signals = [];
        let score = 0;
        let maxScore = 0;

        // Check if in trending regime
        if (regime.regime === 'BULLISH_TRENDING' || regime.regime === 'BEARISH_TRENDING') {
            signals.push('Trending Market');
            score += 1;
        }
        maxScore += 1;

        // MA alignment
        if (indicator.ema9 && indicator.ema20 && indicator.ema50) {
            if (indicator.ema9 > indicator.ema20 && indicator.ema20 > indicator.ema50) {
                signals.push('Bullish MA Alignment');
                score += 1.5;
            } else if (indicator.ema9 < indicator.ema20 && indicator.ema20 < indicator.ema50) {
                signals.push('Bearish MA Alignment');
                score -= 1.5;
            }
        }
        maxScore += 1.5;

        // AI prediction alignment
        if (prediction) {
            if ((score > 0 && prediction.direction === 'LONG') ||
                (score < 0 && prediction.direction === 'SHORT')) {
                signals.push(`AI Confirms ${prediction.direction}`);
                score += prediction.confidence * 2;
            }
        }
        maxScore += 2;

        // MACD confirmation
        if (indicator.macd && indicator.macdSignal) {
            if (score > 0 && indicator.macd > indicator.macdSignal) {
                signals.push('MACD Bullish');
                score += 0.8;
            } else if (score < 0 && indicator.macd < indicator.macdSignal) {
                signals.push('MACD Bearish');
                score -= 0.8;
            }
        }
        maxScore += 0.8;

        const normalizedScore = Math.abs(score) / maxScore;

        if (normalizedScore >= this.minConfidence) {
            const direction = score > 0 ? 'LONG' : 'SHORT';
            const currentPrice = candles[candles.length - 1].close;
            const atr = indicator.atr || currentPrice * 0.02;

            return {
                type: 'TREND_FOLLOWING',
                direction,
                confidence: normalizedScore,
                entry: currentPrice,
                stopLoss: direction === 'LONG' 
                    ? currentPrice - (atr * 2)
                    : currentPrice + (atr * 2),
                takeProfit: direction === 'LONG'
                    ? currentPrice + (atr * 4)
                    : currentPrice - (atr * 4),
                riskReward: 2.0,
                signals,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Strategy 2: Mean Reversion
     */
    detectMeanReversion(price, indicator, patterns) {
        const signals = [];
        let score = 0;

        // RSI extreme
        if (indicator.rsi < 30) {
            signals.push('RSI Oversold');
            score += 1.5;
        } else if (indicator.rsi > 70) {
            signals.push('RSI Overbought');
            score -= 1.5;
        } else {
            return null; // Not in extreme territory
        }

        // Bollinger Bands
        if (indicator.bollingerBand !== undefined) {
            if (indicator.bollingerBand < 0.1) {
                signals.push('At Lower BB');
                score += 1;
            } else if (indicator.bollingerBand > 0.9) {
                signals.push('At Upper BB');
                score -= 1;
            }
        }

        // Check for reversal patterns
        const reversalPatterns = patterns.filter(p => 
            (score > 0 && p.direction === 'BULLISH') ||
            (score < 0 && p.direction === 'BEARISH')
        );

        if (reversalPatterns.length > 0) {
            signals.push(`Pattern: ${reversalPatterns[0].type}`);
            score += reversalPatterns[0].confidence;
        }

        const confidence = Math.min(0.95, Math.abs(score) / 3.5);

        if (confidence >= this.minConfidence) {
            const direction = score > 0 ? 'LONG' : 'SHORT';
            const stopLossDistance = price * 0.015; // 1.5%

            return {
                type: 'MEAN_REVERSION',
                direction,
                confidence,
                entry: price,
                stopLoss: direction === 'LONG'
                    ? price - stopLossDistance
                    : price + stopLossDistance,
                takeProfit: direction === 'LONG'
                    ? indicator.bollingerMiddle || price * 1.02
                    : indicator.bollingerMiddle || price * 0.98,
                riskReward: 2.0,
                signals,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Strategy 3: Breakout Trading
     */
    detectBreakout(candles, indicator, patterns) {
        const signals = [];
        let score = 0;

        const currentPrice = candles[candles.length - 1].close;
        const recentHigh = Math.max(...candles.slice(-20).map(c => c.high));
        const recentLow = Math.min(...candles.slice(-20).map(c => c.low));

        // Check for breakout
        const breakingHigh = currentPrice > recentHigh * 1.001;
        const breakingLow = currentPrice < recentLow * 0.999;

        if (!breakingHigh && !breakingLow) return null;

        if (breakingHigh) {
            signals.push('Breaking Recent High');
            score += 1.5;
        } else {
            signals.push('Breaking Recent Low');
            score -= 1.5;
        }

        // Volume confirmation
        if (indicator.volumeRatio > 1.5) {
            signals.push('High Volume Breakout');
            score += score > 0 ? 1 : -1;
        }

        // Pattern confirmation
        const breakoutPatterns = patterns.filter(p => 
            p.type.includes('TRIANGLE') || p.type.includes('FLAG')
        );

        if (breakoutPatterns.length > 0) {
            signals.push(`Pattern: ${breakoutPatterns[0].type}`);
            score += breakoutPatterns[0].confidence;
        }

        const confidence = Math.min(0.95, Math.abs(score) / 3.5);

        if (confidence >= this.minConfidence) {
            const direction = score > 0 ? 'LONG' : 'SHORT';
            const range = recentHigh - recentLow;

            return {
                type: 'BREAKOUT',
                direction,
                confidence,
                entry: currentPrice,
                stopLoss: direction === 'LONG'
                    ? recentHigh * 0.995
                    : recentLow * 1.005,
                takeProfit: direction === 'LONG'
                    ? currentPrice + range
                    : currentPrice - range,
                riskReward: 2.0,
                signals,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Strategy 4: Pattern-Based Trading
     */
    detectPatternTrade(patterns, indicator, prediction) {
        if (patterns.length === 0) return null;

        // Get highest confidence pattern
        const bestPattern = patterns.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );

        if (bestPattern.confidence < this.minConfidence) return null;

        const signals = [`Pattern: ${bestPattern.type}`];
        let confidence = bestPattern.confidence;

        // Confirm with indicators
        if (bestPattern.direction === 'BULLISH' && indicator.rsi < 50) {
            signals.push('RSI Below 50');
            confidence += 0.05;
        } else if (bestPattern.direction === 'BEARISH' && indicator.rsi > 50) {
            signals.push('RSI Above 50');
            confidence += 0.05;
        }

        // AI confirmation
        if (prediction && prediction.direction === bestPattern.direction) {
            signals.push('AI Confirms');
            confidence += 0.1;
        }

        confidence = Math.min(0.95, confidence);

        if (bestPattern.target) {
            return {
                type: 'PATTERN_TRADE',
                direction: bestPattern.direction,
                confidence,
                entry: bestPattern.level || indicator.price,
                stopLoss: bestPattern.direction === 'BULLISH'
                    ? bestPattern.level * 0.98
                    : bestPattern.level * 1.02,
                takeProfit: bestPattern.target,
                riskReward: 2.0,
                signals,
                pattern: bestPattern.type,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Strategy 5: Divergence Trading
     */
    detectDivergenceTrade(candles, indicators) {
        if (indicators.length < 20) return null;

        const prices = candles.slice(-20).map(c => c.close);
        const rsiValues = indicators.slice(-20).map(i => i.rsi).filter(v => v !== undefined);

        if (rsiValues.length < 20) return null;

        // Detect divergence
        const divergence = technicalIndicators.detectDivergence(prices, rsiValues);

        if (!divergence) return null;

        const signals = [`${divergence.type} Divergence (RSI)`];
        const currentPrice = candles[candles.length - 1].close;
        const latestIndicator = indicators[indicators.length - 1];

        return {
            type: 'DIVERGENCE',
            direction: divergence.type === 'BULLISH' ? 'LONG' : 'SHORT',
            confidence: divergence.strength,
            entry: currentPrice,
            stopLoss: divergence.type === 'BULLISH'
                ? currentPrice * 0.98
                : currentPrice * 1.02,
            takeProfit: divergence.type === 'BULLISH'
                ? currentPrice * 1.04
                : currentPrice * 0.96,
            riskReward: 2.0,
            signals,
            timestamp: Date.now()
        };
    }

    /**
     * Calculate position size based on risk
     */
    calculatePositionSize(setup, accountSize, riskPercent = 1) {
        const riskAmount = accountSize * (riskPercent / 100);
        const stopDistance = Math.abs(setup.entry - setup.stopLoss);
        const stopPercent = (stopDistance / setup.entry) * 100;
        
        const positionSize = riskAmount / stopDistance;
        const notionalValue = positionSize * setup.entry;

        return {
            positionSize,
            notionalValue,
            riskAmount,
            stopPercent,
            potentialProfit: Math.abs(setup.takeProfit - setup.entry) * positionSize,
            riskReward: Math.abs(setup.takeProfit - setup.entry) / stopDistance
        };
    }

    /**
     * Get setup quality score
     */
    getSetupQuality(setup) {
        let quality = 'MEDIUM';
        
        if (setup.confidence >= 0.80) {
            quality = 'EXCELLENT';
        } else if (setup.confidence >= 0.70) {
            quality = 'GOOD';
        } else if (setup.confidence < 0.60) {
            quality = 'POOR';
        }

        return quality;
    }

    /**
     * Get all active setups
     */
    getActiveSetups() {
        return this.activeSetups;
    }

    /**
     * Get setup summary
     */
    getSummary() {
        return {
            total: this.activeSetups.length,
            long: this.activeSetups.filter(s => s.direction === 'LONG').length,
            short: this.activeSetups.filter(s => s.direction === 'SHORT').length,
            avgConfidence: this.activeSetups.length > 0
                ? this.activeSetups.reduce((sum, s) => sum + s.confidence, 0) / this.activeSetups.length
                : 0,
            bestSetup: this.activeSetups.length > 0 ? this.activeSetups[0] : null
        };
    }
}

// Create global instance
const tradeSetupDetector = new TradeSetupDetector();
