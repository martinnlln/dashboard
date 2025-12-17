/**
 * Technical Analysis Indicators
 * ==============================
 * Complete library of TA indicators
 */

class TechnicalIndicators {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Calculate all indicators for candle data
     */
    calculateAll(candles) {
        if (candles.length < 50) {
            console.warn('Not enough data for indicators');
            return [];
        }

        const indicators = [];
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        for (let i = 0; i < candles.length; i++) {
            const ind = {
                timestamp: candles[i].timestamp,
                price: candles[i].close
            };

            // Moving Averages
            if (i >= 9) ind.ema9 = this.EMA(closes.slice(0, i + 1), 9);
            if (i >= 20) ind.ema20 = this.EMA(closes.slice(0, i + 1), 20);
            if (i >= 50) ind.ema50 = this.EMA(closes.slice(0, i + 1), 50);
            if (i >= 20) ind.sma20 = this.SMA(closes.slice(i - 19, i + 1));
            if (i >= 50) ind.sma50 = this.SMA(closes.slice(i - 49, i + 1));
            if (i >= 200) ind.sma200 = this.SMA(closes.slice(i - 199, i + 1));

            // RSI
            if (i >= 14) {
                ind.rsi = this.RSI(closes.slice(Math.max(0, i - 14), i + 1));
            }

            // MACD
            if (i >= 26) {
                const macd = this.MACD(closes.slice(0, i + 1));
                ind.macd = macd.macd;
                ind.macdSignal = macd.signal;
                ind.macdHistogram = macd.histogram;
            }

            // Bollinger Bands
            if (i >= 20) {
                const bb = this.BollingerBands(closes.slice(i - 19, i + 1));
                ind.bollingerUpper = bb.upper;
                ind.bollingerMiddle = bb.middle;
                ind.bollingerLower = bb.lower;
                ind.bollingerBand = (candles[i].close - bb.lower) / (bb.upper - bb.lower);
            }

            // Stochastic
            if (i >= 14) {
                const stoch = this.Stochastic(
                    highs.slice(i - 13, i + 1),
                    lows.slice(i - 13, i + 1),
                    closes.slice(i - 13, i + 1)
                );
                ind.stochK = stoch.k;
                ind.stochD = stoch.d;
            }

            // ADX (Trend Strength)
            if (i >= 14) {
                ind.adx = this.ADX(
                    highs.slice(Math.max(0, i - 14), i + 1),
                    lows.slice(Math.max(0, i - 14), i + 1),
                    closes.slice(Math.max(0, i - 14), i + 1)
                );
            }

            // ATR (Volatility)
            if (i >= 14) {
                ind.atr = this.ATR(
                    highs.slice(i - 13, i + 1),
                    lows.slice(i - 13, i + 1),
                    closes.slice(i - 13, i + 1)
                );
            }

            // Volume indicators
            if (i >= 20) {
                const avgVolume = this.SMA(volumes.slice(i - 19, i + 1));
                ind.volumeRatio = candles[i].volume / avgVolume;
                ind.volumeMA = avgVolume;
            }

            // OBV (On Balance Volume)
            if (i > 0) {
                const prevOBV = indicators[i - 1]?.obv || 0;
                if (candles[i].close > candles[i - 1].close) {
                    ind.obv = prevOBV + candles[i].volume;
                } else if (candles[i].close < candles[i - 1].close) {
                    ind.obv = prevOBV - candles[i].volume;
                } else {
                    ind.obv = prevOBV;
                }
            }

            indicators.push(ind);
        }

        return indicators;
    }

    /**
     * Simple Moving Average
     */
    SMA(data) {
        const sum = data.reduce((a, b) => a + b, 0);
        return sum / data.length;
    }

    /**
     * Exponential Moving Average
     */
    EMA(data, period) {
        const multiplier = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Relative Strength Index
     */
    RSI(data, period = 14) {
        if (data.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }
        }

        const rs = avgGain / (avgLoss || 0.0001);
        return 100 - (100 / (1 + rs));
    }

    /**
     * MACD (Moving Average Convergence Divergence)
     */
    MACD(data) {
        const ema12 = this.EMA(data, 12);
        const ema26 = this.EMA(data, 26);
        const macd = ema12 - ema26;

        // Signal line (9-period EMA of MACD)
        const macdLine = [];
        for (let i = 26; i < data.length; i++) {
            const ema12_i = this.EMA(data.slice(0, i + 1), 12);
            const ema26_i = this.EMA(data.slice(0, i + 1), 26);
            macdLine.push(ema12_i - ema26_i);
        }

        const signal = macdLine.length >= 9 ? this.EMA(macdLine, 9) : macd;
        const histogram = macd - signal;

        return { macd, signal, histogram };
    }

    /**
     * Bollinger Bands
     */
    BollingerBands(data, period = 20, stdDev = 2) {
        const middle = this.SMA(data);
        
        const squaredDiffs = data.map(val => Math.pow(val - middle, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
        const sd = Math.sqrt(variance);

        return {
            upper: middle + (stdDev * sd),
            middle: middle,
            lower: middle - (stdDev * sd)
        };
    }

    /**
     * Stochastic Oscillator
     */
    Stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
        const high = Math.max(...highs);
        const low = Math.min(...lows);
        const close = closes[closes.length - 1];

        const k = ((close - low) / (high - low || 1)) * 100;
        
        // D is 3-period SMA of K
        const d = k; // Simplified for single calculation

        return { k, d };
    }

    /**
     * Average Directional Index (Trend Strength)
     */
    ADX(highs, lows, closes, period = 14) {
        if (highs.length < period + 1) return 0;

        let plusDM = 0;
        let minusDM = 0;
        let tr = 0;

        for (let i = 1; i < highs.length; i++) {
            const highDiff = highs[i] - highs[i - 1];
            const lowDiff = lows[i - 1] - lows[i];

            plusDM += Math.max(highDiff, 0);
            minusDM += Math.max(lowDiff, 0);

            const trueRange = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            tr += trueRange;
        }

        const plusDI = (plusDM / tr) * 100;
        const minusDI = (minusDM / tr) * 100;
        const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;

        return dx; // Simplified ADX
    }

    /**
     * Average True Range (Volatility)
     */
    ATR(highs, lows, closes, period = 14) {
        let atr = 0;
        
        for (let i = 1; i < highs.length; i++) {
            const trueRange = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            atr += trueRange;
        }

        return atr / (highs.length - 1);
    }

    /**
     * Fibonacci Retracement Levels
     */
    FibonacciLevels(high, low) {
        const diff = high - low;
        return {
            level_0: high,
            level_236: high - (diff * 0.236),
            level_382: high - (diff * 0.382),
            level_500: high - (diff * 0.500),
            level_618: high - (diff * 0.618),
            level_786: high - (diff * 0.786),
            level_100: low
        };
    }

    /**
     * Pivot Points (Support/Resistance)
     */
    PivotPoints(high, low, close) {
        const pivot = (high + low + close) / 3;
        
        return {
            pivot: pivot,
            r1: (2 * pivot) - low,
            r2: pivot + (high - low),
            r3: high + 2 * (pivot - low),
            s1: (2 * pivot) - high,
            s2: pivot - (high - low),
            s3: low - 2 * (high - pivot)
        };
    }

    /**
     * Ichimoku Cloud
     */
    IchimokuCloud(highs, lows, closes) {
        const tenkan = (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2;
        const kijun = (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2;
        const senkouA = (tenkan + kijun) / 2;
        const senkouB = (Math.max(...highs.slice(-52)) + Math.min(...lows.slice(-52))) / 2;
        const chikou = closes[closes.length - 26] || closes[closes.length - 1];

        return {
            tenkan,    // Conversion Line
            kijun,     // Base Line
            senkouA,   // Leading Span A
            senkouB,   // Leading Span B
            chikou     // Lagging Span
        };
    }

    /**
     * Money Flow Index
     */
    MFI(highs, lows, closes, volumes, period = 14) {
        const typicalPrices = closes.map((close, i) => 
            (highs[i] + lows[i] + close) / 3
        );

        let positiveFlow = 0;
        let negativeFlow = 0;

        for (let i = 1; i < Math.min(period + 1, typicalPrices.length); i++) {
            const moneyFlow = typicalPrices[i] * volumes[i];
            if (typicalPrices[i] > typicalPrices[i - 1]) {
                positiveFlow += moneyFlow;
            } else {
                negativeFlow += moneyFlow;
            }
        }

        const mfi = 100 - (100 / (1 + (positiveFlow / (negativeFlow || 1))));
        return mfi;
    }

    /**
     * Detect indicator divergences (bullish/bearish)
     */
    detectDivergence(prices, indicator, periods = 20) {
        if (prices.length < periods || indicator.length < periods) {
            return null;
        }

        const recentPrices = prices.slice(-periods);
        const recentIndicator = indicator.slice(-periods);

        // Find swing highs and lows
        const priceHighs = this.findSwingHighs(recentPrices);
        const priceLows = this.findSwingLows(recentPrices);
        const indHighs = this.findSwingHighs(recentIndicator);
        const indLows = this.findSwingLows(recentIndicator);

        // Bullish divergence: price makes lower low, indicator makes higher low
        if (priceLows.length >= 2 && indLows.length >= 2) {
            const priceLower = priceLows[priceLows.length - 1] < priceLows[priceLows.length - 2];
            const indHigher = indLows[indLows.length - 1] > indLows[indLows.length - 2];
            
            if (priceLower && indHigher) {
                return { type: 'BULLISH', strength: 0.8 };
            }
        }

        // Bearish divergence: price makes higher high, indicator makes lower high
        if (priceHighs.length >= 2 && indHighs.length >= 2) {
            const priceHigher = priceHighs[priceHighs.length - 1] > priceHighs[priceHighs.length - 2];
            const indLower = indHighs[indHighs.length - 1] < indHighs[indHighs.length - 2];
            
            if (priceHigher && indLower) {
                return { type: 'BEARISH', strength: 0.8 };
            }
        }

        return null;
    }

    /**
     * Find swing highs
     */
    findSwingHighs(data, period = 5) {
        const highs = [];
        for (let i = period; i < data.length - period; i++) {
            let isHigh = true;
            for (let j = i - period; j <= i + period; j++) {
                if (j !== i && data[j] >= data[i]) {
                    isHigh = false;
                    break;
                }
            }
            if (isHigh) highs.push(data[i]);
        }
        return highs;
    }

    /**
     * Find swing lows
     */
    findSwingLows(data, period = 5) {
        const lows = [];
        for (let i = period; i < data.length - period; i++) {
            let isLow = true;
            for (let j = i - period; j <= i + period; j++) {
                if (j !== i && data[j] <= data[i]) {
                    isLow = false;
                    break;
                }
            }
            if (isLow) lows.push(data[i]);
        }
        return lows;
    }
}

// Create global instance
const technicalIndicators = new TechnicalIndicators();
