/**
 * Alert Manager
 * =============
 * Manages alerts and notifications
 */

class AlertManager {
    constructor() {
        this.alerts = [];
        this.triggeredAlerts = new Set();
    }

    /**
     * Initialize alert manager
     */
    init() {
        this.setupModals();
        this.loadAlerts();
        this.requestPermissions();
    }

    /**
     * Setup alert modal
     */
    setupModals() {
        const alertBtn = document.getElementById('alerts-btn');
        const modal = document.getElementById('alert-modal');
        const closeBtn = document.getElementById('alert-modal-close');
        const addBtn = document.getElementById('add-alert-btn');

        if (alertBtn) {
            alertBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                this.renderActiveAlerts();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addAlert();
            });
        }

        // Close modal on background click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    /**
     * Request notification permissions
     */
    async requestPermissions() {
        if (CONFIG.ALERTS.BROWSER.ENABLED) {
            await Utils.requestNotificationPermission();
        }
    }

    /**
     * Add new alert
     */
    addAlert() {
        const type = document.getElementById('alert-type').value;
        const threshold = parseFloat(document.getElementById('alert-threshold').value);
        const browser = document.getElementById('alert-browser').checked;
        const sound = document.getElementById('alert-sound').checked;
        const telegram = document.getElementById('alert-telegram').checked;

        if (!threshold || isNaN(threshold)) {
            Utils.showToast('Please enter a valid threshold', 'error');
            return;
        }

        const alert = {
            id: Utils.generateId(),
            type,
            threshold,
            notifications: { browser, sound, telegram },
            active: true,
            lastTriggered: null
        };

        this.alerts.push(alert);
        this.saveAlerts();
        this.renderActiveAlerts();

        Utils.showToast('Alert added successfully', 'success');

        // Clear form
        document.getElementById('alert-threshold').value = '';
    }

    /**
     * Remove alert
     */
    removeAlert(id) {
        this.alerts = this.alerts.filter(a => a.id !== id);
        this.triggeredAlerts.delete(id);
        this.saveAlerts();
        this.renderActiveAlerts();
        Utils.showToast('Alert removed', 'success');
    }

    /**
     * Render active alerts
     */
    renderActiveAlerts() {
        const container = document.getElementById('active-alerts-list');
        if (!container) return;

        if (this.alerts.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 16px;">No active alerts</div>';
            return;
        }

        const html = this.alerts.map(alert => `
            <div style="padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                            ${this.getAlertTypeLabel(alert.type)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary);">
                            Threshold: ${alert.threshold}
                        </div>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                            ${this.getNotificationMethods(alert.notifications)}
                        </div>
                    </div>
                    <button 
                        onclick="alertManager.removeAlert('${alert.id}')"
                        style="background: var(--color-short); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        REMOVE
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Get alert type label
     */
    getAlertTypeLabel(type) {
        const labels = {
            price: 'Price Level',
            liquidation: 'Liquidation Cascade',
            volume: 'Volume Spike',
            cvd: 'CVD Divergence'
        };
        return labels[type] || type;
    }

    /**
     * Get notification methods string
     */
    getNotificationMethods(notifications) {
        const methods = [];
        if (notifications.browser) methods.push('Browser');
        if (notifications.sound) methods.push('Sound');
        if (notifications.telegram) methods.push('Telegram');
        return methods.length > 0 ? methods.join(', ') : 'None';
    }

    /**
     * Check alerts
     */
    checkAlerts(data) {
        this.alerts.forEach(alert => {
            if (!alert.active) return;

            let triggered = false;
            let message = '';

            switch (alert.type) {
                case 'price':
                    if (data.price && Math.abs(data.price - alert.threshold) < 0.01) {
                        triggered = true;
                        message = `Price reached ${Utils.formatPrice(alert.threshold)}`;
                    }
                    break;

                case 'liquidation':
                    if (data.liquidationAmount && data.liquidationAmount >= alert.threshold) {
                        triggered = true;
                        message = `Large liquidation: ${Utils.formatUSD(data.liquidationAmount)}`;
                    }
                    break;

                case 'volume':
                    if (data.volumeSpike && data.volumeSpike >= alert.threshold) {
                        triggered = true;
                        message = `Volume spike: ${Utils.formatNumber(data.volumeSpike)}`;
                    }
                    break;

                case 'cvd':
                    if (data.cvdDivergence && Math.abs(data.cvdDivergence) >= alert.threshold) {
                        triggered = true;
                        message = `CVD divergence: ${Utils.formatNumber(data.cvdDivergence)}`;
                    }
                    break;
            }

            if (triggered && !this.triggeredAlerts.has(alert.id)) {
                this.triggerAlert(alert, message);
                this.triggeredAlerts.add(alert.id);
                alert.lastTriggered = Date.now();

                // Reset trigger after 5 minutes
                setTimeout(() => {
                    this.triggeredAlerts.delete(alert.id);
                }, 300000);
            }
        });
    }

    /**
     * Trigger alert
     */
    triggerAlert(alert, message) {
        const title = this.getAlertTypeLabel(alert.type);

        // Browser notification
        if (alert.notifications.browser && CONFIG.ALERTS.BROWSER.ENABLED) {
            Utils.showNotification(title, message);
        }

        // Sound notification
        if (alert.notifications.sound && CONFIG.ALERTS.SOUND.ENABLED) {
            Utils.playSound(alert.type);
        }

        // Telegram notification
        if (alert.notifications.telegram && CONFIG.ALERTS.TELEGRAM.ENABLED) {
            const telegramMessage = `🔔 <b>${title}</b>\n${message}\n\n${new Date().toLocaleString()}`;
            apiManager.sendTelegramAlert(telegramMessage);
        }

        // Toast notification
        Utils.showToast(`${title}: ${message}`, 'warning', 5000);
    }

    /**
     * Save alerts to local storage
     */
    saveAlerts() {
        Utils.setLocalStorage(CONFIG.STORAGE.ALERTS, this.alerts);
    }

    /**
     * Load alerts from local storage
     */
    loadAlerts() {
        const saved = Utils.getLocalStorage(CONFIG.STORAGE.ALERTS, []);
        this.alerts = saved;
    }

    /**
     * Clear all alerts
     */
    clearAlerts() {
        this.alerts = [];
        this.triggeredAlerts.clear();
        this.saveAlerts();
        this.renderActiveAlerts();
    }
}

// Create global instance
const alertManager = new AlertManager();
