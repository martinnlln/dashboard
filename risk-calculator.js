/**
 * Risk Management Calculator
 * ===========================
 * Calculates position sizing, risk/reward, and trade management
 */

class RiskCalculator {
    constructor() {
        this.defaultAccountSize = 10000; // Default $10k
        this.defaultRiskPercent = 1; // 1% risk per trade
        this.maxPositions = 5;
    }

    /**
     * Calculate position size based on risk
     */
    calculatePositionSize(entry, stopLoss, accountSize, riskPercent) {
        const riskAmount = accountSize * (riskPercent / 100);
        const stopDistance = Math.abs(entry - stopLoss);
        const stopPercent = (stopDistance / entry) * 100;
        
        // Calculate position size
        const quantity = riskAmount / stopDistance;
        const notionalValue = quantity * entry;
        
        // Calculate leverage needed (if any)
        const leverage = notionalValue / accountSize;

        return {
            quantity,
            notionalValue,
            riskAmount,
            stopDistance,
            stopPercent,
            leverage: Math.ceil(leverage),
            maxLoss: riskAmount
        };
    }

    /**
     * Calculate risk/reward ratio
     */
    calculateRiskReward(entry, stopLoss, takeProfit) {
        const risk = Math.abs(entry - stopLoss);
        const reward = Math.abs(takeProfit - entry);
        
        return {
            risk,
            reward,
            ratio: reward / risk,
            riskPercent: (risk / entry) * 100,
            rewardPercent: (reward / entry) * 100
        };
    }

    /**
     * Calculate Kelly Criterion for optimal position sizing
     */
    calculateKellyCriterion(winRate, avgWin, avgLoss) {
        // Kelly % = (Win% / Avg Loss) - (Loss% / Avg Win)
        const lossRate = 1 - winRate;
        const kelly = (winRate / avgLoss) - (lossRate / avgWin);
        
        // Use fractional Kelly for safety (typically 0.25 - 0.5)
        const fractionalKelly = kelly * 0.5;
        
        return {
            fullKelly: Math.max(0, Math.min(1, kelly)) * 100,
            halfKelly: Math.max(0, Math.min(1, fractionalKelly)) * 100,
            recommended: Math.max(0, Math.min(1, fractionalKelly)) * 100
        };
    }

    /**
     * Calculate position risk metrics
     */
    calculatePositionRisk(positions, accountSize) {
        let totalRisk = 0;
        let totalExposure = 0;

        positions.forEach(pos => {
            const riskAmount = Math.abs(pos.entry - pos.stopLoss) * pos.quantity;
            totalRisk += riskAmount;
            totalExposure += pos.entry * pos.quantity;
        });

        return {
            totalRisk,
            totalExposure,
            riskPercent: (totalRisk / accountSize) * 100,
            exposurePercent: (totalExposure / accountSize) * 100,
            numberOfPositions: positions.length,
            avgRiskPerTrade: totalRisk / positions.length
        };
    }

    /**
     * Calculate break-even price after fees
     */
    calculateBreakEven(entry, direction, feePercent = 0.1) {
        const feeCost = entry * (feePercent / 100);
        
        if (direction === 'LONG') {
            return entry + (feeCost * 2); // Entry fee + exit fee
        } else {
            return entry - (feeCost * 2);
        }
    }

    /**
     * Calculate trailing stop levels
     */
    calculateTrailingStop(entry, currentPrice, direction, atrValue) {
        const multiplier = 2; // 2x ATR
        
        if (direction === 'LONG') {
            const trailingStop = currentPrice - (atrValue * multiplier);
            const profit = currentPrice - entry;
            const profitPercent = (profit / entry) * 100;
            
            return {
                trailingStop,
                profit,
                profitPercent,
                shouldMove: currentPrice > entry && trailingStop > entry
            };
        } else {
            const trailingStop = currentPrice + (atrValue * multiplier);
            const profit = entry - currentPrice;
            const profitPercent = (profit / entry) * 100;
            
            return {
                trailingStop,
                profit,
                profitPercent,
                shouldMove: currentPrice < entry && trailingStop < entry
            };
        }
    }

    /**
     * Calculate partial take profit levels
     */
    calculatePartialTakeProfits(entry, finalTarget, direction) {
        const distance = Math.abs(finalTarget - entry);
        const levels = [];

        // 25% at 1:1
        levels.push({
            percent: 25,
            price: direction === 'LONG' ? entry + distance * 0.5 : entry - distance * 0.5,
            ratio: 0.5
        });

        // 25% at 1:1.5
        levels.push({
            percent: 25,
            price: direction === 'LONG' ? entry + distance * 0.75 : entry - distance * 0.75,
            ratio: 0.75
        });

        // 50% at final target
        levels.push({
            percent: 50,
            price: finalTarget,
            ratio: 1.0
        });

        return levels;
    }

    /**
     * Calculate portfolio heat (total risk across all positions)
     */
    calculatePortfolioHeat(positions, accountSize) {
        let totalHeat = 0;

        positions.forEach(pos => {
            const positionRisk = Math.abs(pos.entry - pos.stopLoss) * pos.quantity;
            const riskPercent = (positionRisk / accountSize) * 100;
            totalHeat += riskPercent;
        });

        return {
            totalHeat,
            isOverheated: totalHeat > 5, // Max 5% total portfolio risk
            maxPositions: this.maxPositions,
            availableRisk: Math.max(0, 5 - totalHeat)
        };
    }

    /**
     * Calculate expected value of trade
     */
    calculateExpectedValue(setup, historicalWinRate = 0.55) {
        const risk = Math.abs(setup.entry - setup.stopLoss);
        const reward = Math.abs(setup.takeProfit - setup.entry);
        
        const expectedValue = (historicalWinRate * reward) - ((1 - historicalWinRate) * risk);
        const expectedPercent = (expectedValue / setup.entry) * 100;

        return {
            expectedValue,
            expectedPercent,
            isPositive: expectedValue > 0,
            winRate: historicalWinRate,
            riskReward: reward / risk
        };
    }

    /**
     * Calculate Sharpe Ratio for strategy evaluation
     */
    calculateSharpeRatio(returns, riskFreeRate = 0.02) {
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const excessReturn = avgReturn - (riskFreeRate / 252); // Daily risk-free rate
        
        const variance = returns.reduce((sum, r) => 
            sum + Math.pow(r - avgReturn, 2), 0
        ) / returns.length;
        
        const stdDev = Math.sqrt(variance);
        const sharpe = stdDev === 0 ? 0 : excessReturn / stdDev;
        
        return {
            sharpe: sharpe * Math.sqrt(252), // Annualized
            avgReturn: avgReturn * 252 * 100,
            volatility: stdDev * Math.sqrt(252) * 100
        };
    }

    /**
     * Calculate Maximum Drawdown
     */
    calculateMaxDrawdown(equityCurve) {
        let maxDrawdown = 0;
        let peak = equityCurve[0];

        equityCurve.forEach(value => {
            if (value > peak) {
                peak = value;
            }
            const drawdown = ((peak - value) / peak) * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        return {
            maxDrawdown,
            isAcceptable: maxDrawdown < 20 // Max 20% drawdown
        };
    }

    /**
     * Generate risk report for a trade setup
     */
    generateRiskReport(setup, accountSize, riskPercent) {
        const position = this.calculatePositionSize(
            setup.entry,
            setup.stopLoss,
            accountSize,
            riskPercent
        );

        const rr = this.calculateRiskReward(
            setup.entry,
            setup.stopLoss,
            setup.takeProfit
        );

        const breakEven = this.calculateBreakEven(setup.entry, setup.direction);
        
        const partials = this.calculatePartialTakeProfits(
            setup.entry,
            setup.takeProfit,
            setup.direction
        );

        return {
            setup,
            position,
            riskReward: rr,
            breakEven,
            partials,
            recommendation: this.getTradeRecommendation(setup, rr, position)
        };
    }

    /**
     * Get trade recommendation
     */
    getTradeRecommendation(setup, rr, position) {
        const issues = [];
        let recommendation = 'TAKE_TRADE';

        // Check R:R
        if (rr.ratio < 1.5) {
            issues.push('Risk/Reward below 1.5:1');
            recommendation = 'REDUCE_SIZE';
        }

        // Check stop loss
        if (position.stopPercent > 3) {
            issues.push('Stop loss too wide (>3%)');
            recommendation = 'REDUCE_SIZE';
        }

        // Check leverage
        if (position.leverage > 10) {
            issues.push('Excessive leverage required');
            recommendation = 'SKIP_TRADE';
        }

        // Check confidence
        if (setup.confidence < 0.65) {
            issues.push('Low setup confidence');
            recommendation = 'WAIT';
        }

        if (issues.length === 0) {
            recommendation = 'TAKE_TRADE';
        }

        return {
            action: recommendation,
            issues,
            score: this.calculateTradeScore(setup, rr, position)
        };
    }

    /**
     * Calculate overall trade score (0-100)
     */
    calculateTradeScore(setup, rr, position) {
        let score = 0;

        // Confidence (40 points)
        score += setup.confidence * 40;

        // Risk/Reward (30 points)
        score += Math.min(30, (rr.ratio / 3) * 30);

        // Stop loss (20 points)
        score += Math.max(0, 20 - (position.stopPercent * 5));

        // Leverage (10 points)
        score += Math.max(0, 10 - position.leverage);

        return Math.min(100, Math.max(0, score));
    }
}

// Create global instance
const riskCalculator = new RiskCalculator();
