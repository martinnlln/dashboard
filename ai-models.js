/**
 * AI Trading Models
 * =================
 * Machine learning models for price prediction and trade signal generation
 */

class AITradingModels {
    constructor() {
        this.models = {
            lstm: null,
            randomForest: null,
            ensemble: null
        };
        this.isLoaded = false;
        this.predictions = [];
        this.confidence = 0;
        this.trainingData = [];
        this.features = [];
    }

    /**
     * Initialize and load ML models
     */
    async init() {
        console.log('🤖 Initializing AI Trading Models...');
        
        // Check if TensorFlow.js is available
        if (typeof tf === 'undefined') {
            console.warn('TensorFlow.js not loaded - ML features disabled');
            return false;
        }

        try {
            // Try to load pre-trained models or create new ones
            await this.loadOrCreateModels();
            this.isLoaded = true;
            console.log('✅ AI Models loaded successfully');
            return true;
        } catch (err) {
            console.error('Failed to initialize AI models:', err);
            return false;
        }
    }

    /**
     * Load pre-trained models or create new ones
     */
    async loadOrCreateModels() {
        // Try to load from local storage
        const savedModel = Utils.getLocalStorage('ai_model_lstm', null);
        
        if (savedModel) {
            // Load existing model
            this.models.lstm = await tf.loadLayersModel('indexeddb://lstm-price-model');
            console.log('Loaded existing LSTM model');
        } else {
            // Create new model
            this.models.lstm = this.createLSTMModel();
            console.log('Created new LSTM model');
        }
    }

    /**
     * Create LSTM model for price prediction
     */
    createLSTMModel() {
        const model = tf.sequential();

        // Input layer
        model.add(tf.layers.lstm({
            units: 50,
            returnSequences: true,
            inputShape: [60, 8] // 60 timesteps, 8 features
        }));

        model.add(tf.layers.dropout({ rate: 0.2 }));

        // Hidden LSTM layer
        model.add(tf.layers.lstm({
            units: 50,
            returnSequences: false
        }));

        model.add(tf.layers.dropout({ rate: 0.2 }));

        // Dense layers
        model.add(tf.layers.dense({ units: 25, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1 })); // Output: price prediction

        // Compile model
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return model;
    }

    /**
     * Prepare training data from historical candles
     */
    prepareTrainingData(candles, indicators) {
        const sequences = [];
        const targets = [];
        const lookback = 60; // Use 60 candles to predict next

        for (let i = lookback; i < candles.length; i++) {
            const sequence = [];
            
            for (let j = i - lookback; j < i; j++) {
                const candle = candles[j];
                const ind = indicators[j] || {};
                
                // Feature engineering
                sequence.push([
                    this.normalize(candle.close, candle.open),
                    this.normalize(candle.high, candle.low),
                    this.normalize(candle.volume, 1000000),
                    ind.rsi || 50,
                    ind.macd || 0,
                    ind.bollingerBand || 0,
                    ind.ema20 || candle.close,
                    ind.volumeRatio || 1
                ]);
            }

            sequences.push(sequence);
            targets.push(candles[i].close);
        }

        return { sequences, targets };
    }

    /**
     * Normalize value for neural network
     */
    normalize(value, baseline) {
        return (value - baseline) / (baseline || 1);
    }

    /**
     * Train model on historical data
     */
    async trainModel(candles, indicators, epochs = 50) {
        if (!this.models.lstm) {
            console.error('Model not initialized');
            return;
        }

        console.log('🎓 Training AI model...');
        Utils.showToast('Training AI model...', 'info');

        const { sequences, targets } = this.prepareTrainingData(candles, indicators);

        // Convert to tensors
        const xs = tf.tensor3d(sequences);
        const ys = tf.tensor2d(targets, [targets.length, 1]);

        // Train model
        await this.models.lstm.fit(xs, ys, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
                    }
                }
            }
        });

        // Save model
        await this.models.lstm.save('indexeddb://lstm-price-model');
        Utils.setLocalStorage('ai_model_lstm', { trained: true, date: Date.now() });

        // Cleanup
        xs.dispose();
        ys.dispose();

        console.log('✅ Model training complete');
        Utils.showToast('AI model trained successfully!', 'success');
    }

    /**
     * Predict next price movement
     */
    async predict(recentCandles, recentIndicators) {
        if (!this.models.lstm || recentCandles.length < 60) {
            return null;
        }

        const { sequences } = this.prepareTrainingData(
            recentCandles.slice(-61), 
            recentIndicators.slice(-61)
        );

        if (sequences.length === 0) return null;

        const lastSequence = sequences[sequences.length - 1];
        const inputTensor = tf.tensor3d([lastSequence]);

        const prediction = this.models.lstm.predict(inputTensor);
        const predictedPrice = await prediction.data();

        // Calculate confidence based on recent prediction accuracy
        const confidence = this.calculateConfidence(recentCandles);

        inputTensor.dispose();
        prediction.dispose();

        const currentPrice = recentCandles[recentCandles.length - 1].close;
        const predictedChange = ((predictedPrice[0] - currentPrice) / currentPrice) * 100;

        return {
            price: predictedPrice[0],
            change: predictedChange,
            confidence: confidence,
            direction: predictedChange > 0 ? 'LONG' : 'SHORT',
            timestamp: Date.now()
        };
    }

    /**
     * Calculate prediction confidence
     */
    calculateConfidence(recentCandles) {
        // Simple confidence based on volatility
        const volatility = this.calculateVolatility(recentCandles.slice(-20));
        const baseConfidence = 0.5;
        
        // Lower volatility = higher confidence
        const confidence = Math.max(0.3, Math.min(0.95, baseConfidence + (0.3 - volatility)));
        
        return confidence;
    }

    /**
     * Calculate volatility
     */
    calculateVolatility(candles) {
        const returns = [];
        for (let i = 1; i < candles.length; i++) {
            const ret = (candles[i].close - candles[i-1].close) / candles[i-1].close;
            returns.push(ret);
        }

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Detect market regime using ML
     */
    detectMarketRegime(candles, volume) {
        const volatility = this.calculateVolatility(candles.slice(-20));
        const volumeTrend = this.calculateVolumeTrend(volume.slice(-20));
        const priceTrend = this.calculatePriceTrend(candles.slice(-20));

        let regime = 'RANGING';
        let confidence = 0.5;

        if (volatility > 0.03 && volumeTrend > 1.2) {
            regime = 'VOLATILE';
            confidence = 0.8;
        } else if (Math.abs(priceTrend) > 0.02 && volumeTrend > 1.0) {
            regime = priceTrend > 0 ? 'BULLISH_TRENDING' : 'BEARISH_TRENDING';
            confidence = 0.75;
        } else if (volatility < 0.01) {
            regime = 'RANGING';
            confidence = 0.7;
        }

        return { regime, confidence, volatility, priceTrend };
    }

    /**
     * Calculate volume trend
     */
    calculateVolumeTrend(volumes) {
        const recentAvg = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const olderAvg = volumes.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        return recentAvg / (olderAvg || 1);
    }

    /**
     * Calculate price trend
     */
    calculatePriceTrend(candles) {
        const firstPrice = candles[0].close;
        const lastPrice = candles[candles.length - 1].close;
        return (lastPrice - firstPrice) / firstPrice;
    }

    /**
     * Generate trade signal using ensemble of indicators
     */
    generateTradeSignal(price, indicators, prediction, regime) {
        const signals = [];
        let totalScore = 0;
        let maxScore = 0;

        // RSI Signal
        if (indicators.rsi < 30) {
            signals.push({ name: 'RSI Oversold', score: 0.8, direction: 'LONG' });
            totalScore += 0.8;
        } else if (indicators.rsi > 70) {
            signals.push({ name: 'RSI Overbought', score: 0.8, direction: 'SHORT' });
            totalScore -= 0.8;
        }
        maxScore += 0.8;

        // MACD Signal
        if (indicators.macd > indicators.macdSignal && indicators.macdHistogram > 0) {
            signals.push({ name: 'MACD Bullish', score: 0.7, direction: 'LONG' });
            totalScore += 0.7;
        } else if (indicators.macd < indicators.macdSignal && indicators.macdHistogram < 0) {
            signals.push({ name: 'MACD Bearish', score: 0.7, direction: 'SHORT' });
            totalScore -= 0.7;
        }
        maxScore += 0.7;

        // Bollinger Bands Signal
        if (price < indicators.bollingerLower) {
            signals.push({ name: 'BB Oversold', score: 0.6, direction: 'LONG' });
            totalScore += 0.6;
        } else if (price > indicators.bollingerUpper) {
            signals.push({ name: 'BB Overbought', score: 0.6, direction: 'SHORT' });
            totalScore -= 0.6;
        }
        maxScore += 0.6;

        // AI Prediction Signal
        if (prediction) {
            const predScore = Math.abs(prediction.change) * prediction.confidence * 0.01;
            signals.push({ 
                name: 'AI Prediction', 
                score: predScore, 
                direction: prediction.direction 
            });
            totalScore += prediction.direction === 'LONG' ? predScore : -predScore;
            maxScore += 0.9;
        }

        // Volume Signal
        if (indicators.volumeRatio > 1.5) {
            signals.push({ name: 'High Volume', score: 0.5, direction: 'NEUTRAL' });
        }

        // Calculate final signal
        const normalizedScore = totalScore / (maxScore || 1);
        
        let action = 'WAIT';
        let confidence = Math.abs(normalizedScore);

        if (normalizedScore > 0.3) {
            action = 'LONG';
        } else if (normalizedScore < -0.3) {
            action = 'SHORT';
        }

        return {
            action,
            confidence: Math.min(0.95, confidence),
            score: normalizedScore,
            signals,
            regime: regime.regime,
            timestamp: Date.now()
        };
    }

    /**
     * Get model performance metrics
     */
    getModelMetrics() {
        return {
            isLoaded: this.isLoaded,
            lastPrediction: this.predictions[this.predictions.length - 1],
            predictionCount: this.predictions.length,
            averageConfidence: this.predictions.length > 0 
                ? this.predictions.reduce((sum, p) => sum + p.confidence, 0) / this.predictions.length 
                : 0
        };
    }
}

// Create global instance
const aiModels = new AITradingModels();
