/**
 * Utility functions for PhishShield extension
 */

// API Configuration
export const API_CONFIG = {
    BASE_URL: process.env.NODE_ENV === 'production' 
        ? 'https://your-phishshield-api.com' 
        : 'http://localhost:8000',
    ENDPOINTS: {
        ANALYZE: '/analyze',
        FEEDBACK: '/feedback',
        HEALTH: '/health',
        WHITELIST: '/whitelist',
        BLACKLIST: '/blacklist'
    }
};

// Risk level configurations
export const RISK_LEVELS = {
    safe: { 
        color: '#4CAF50', 
        icon: '✅', 
        label: 'Safe',
        description: 'This email appears to be legitimate'
    },
    low: { 
        color: '#FF9800', 
        icon: '⚠️', 
        label: 'Low Risk',
        description: 'Minor security concerns detected'
    },
    medium: { 
        color: '#FF5722', 
        icon: '🚨', 
        label: 'Medium Risk',
        description: 'Several suspicious indicators found'
    },
    high: { 
        color: '#F44336', 
        icon: '🔴', 
        label: 'High Risk',
        description: 'Strong phishing indicators detected'
    },
    critical: { 
        color: '#B71C1C', 
        icon: '💀', 
        label: 'Critical Risk',
        description: 'Highly likely to be a phishing attempt'
    }
};

/**
 * Storage utilities for extension data
 */
export class StorageManager {
    static async get(key, defaultValue = null) {
        try {
            const result = await chrome.storage.sync.get([key]);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    static async set(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    static async getAll() {
        try {
            return await chrome.storage.sync.get(null);
        } catch (error) {
            console.error('Storage getAll error:', error);
            return {};
        }
    }

    static async remove(key) {
        try {
            await chrome.storage.sync.remove(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    static async clear() {
        try {
            await chrome.storage.sync.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    // Local storage methods for temporary data
    static async getLocal(key, defaultValue = null) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (error) {
            console.error('Local storage get error:', error);
            return defaultValue;
        }
    }

    static async setLocal(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error('Local storage set error:', error);
            return false;
        }
    }
}

/**
 * Message passing utilities
 */
export class MessageHandler {
    static async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Message error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response' });
                }
            });
        });
    }

    static async sendTabMessage(tabId, message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Tab message error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response' });
                }
            });
        });
    }
}

/**
 * URL and email validation utilities
 */
export class ValidationUtils {
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static extractDomain(email) {
        if (!this.isValidEmail(email)) return null;
        return email.split('@')[1];
    }

    static extractUrlDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return null;
        }
    }

    static isSuspiciousDomain(domain) {
        const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.click', '.download'];
        return suspiciousTlds.some(tld => domain.endsWith(tld));
    }

    static containsSuspiciousChars(text) {
        // Check for common homograph attack characters
        const suspiciousChars = /[οо0аеррхуіІ]/;
        return suspiciousChars.test(text);
    }
}

/**
 * Date and time utilities
 */
export class TimeUtils {
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    static getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return `${Math.floor(diff / 86400000)} days ago`;
    }

    static isRecent(timestamp, maxAgeMs = 300000) { // 5 minutes default
        return Date.now() - timestamp < maxAgeMs;
    }
}

/**
 * UI utilities
 */
export class UIUtils {
    static showNotification(message, type = 'info', duration = 5000) {
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'PhishShield',
                message: message
            });
        }
    }

    static getRiskConfig(riskLevel) {
        return RISK_LEVELS[riskLevel] || RISK_LEVELS.safe;
    }

    static formatRiskScore(score) {
        return Math.round(score);
    }

    static truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    static sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}

/**
 * Security utilities
 */
export class SecurityUtils {
    static generateSecureId() {
        return crypto.randomUUID ? crypto.randomUUID() : 
               Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    static isSecureContext() {
        return window.isSecureContext || location.protocol === 'https:';
    }
}

/**
 * Extension environment detection
 */
export class EnvironmentUtils {
    static isGmail() {
        return window.location.hostname === 'mail.google.com';
    }

    static isOutlook() {
        const hostname = window.location.hostname;
        return hostname.includes('outlook.live.com') ||
               hostname.includes('outlook.office.com') ||
               hostname.includes('outlook.office365.com');
    }

    static getEmailProvider() {
        if (this.isGmail()) return 'gmail';
        if (this.isOutlook()) return 'outlook';
        return 'unknown';
    }

    static isSupportedEmailPage() {
        return this.isGmail() || this.isOutlook();
    }

    static getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'chrome';
        if (ua.includes('Firefox')) return 'firefox';
        if (ua.includes('Edge')) return 'edge';
        return 'unknown';
    }
}

/**
 * Debugging and logging utilities
 */
export class DebugUtils {
    static log(level, message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = new Date().toISOString();
            const prefix = `[PhishShield ${timestamp}]`;
            
            switch (level) {
                case 'error':
                    console.error(prefix, message, data);
                    break;
                case 'warn':
                    console.warn(prefix, message, data);
                    break;
                case 'info':
                    console.info(prefix, message, data);
                    break;
                default:
                    console.log(prefix, message, data);
            }
        }
    }

    static error(message, error = null) {
        this.log('error', message, error);
    }

    static warn(message, data = null) {
        this.log('warn', message, data);
    }

    static info(message, data = null) {
        this.log('info', message, data);
    }

    static debug(message, data = null) {
        this.log('debug', message, data);
    }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceUtils {
    static startTimer(name) {
        if (performance.mark) {
            performance.mark(`${name}-start`);
        }
        return Date.now();
    }

    static endTimer(name, startTime) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (performance.mark && performance.measure) {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
        }
        
        DebugUtils.debug(`Performance: ${name} took ${duration}ms`);
        return duration;
    }
}

// Export all utilities as default
export default {
    API_CONFIG,
    RISK_LEVELS,
    StorageManager,
    MessageHandler,
    ValidationUtils,
    TimeUtils,
    UIUtils,
    SecurityUtils,
    EnvironmentUtils,
    DebugUtils,
    PerformanceUtils
};