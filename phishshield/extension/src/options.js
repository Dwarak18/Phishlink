/**
 * PhishShield Options/Settings Page JavaScript
 */

class PhishShieldOptions {
    constructor() {
        this.settings = {};
        this.initialize();
    }

    async initialize() {
        console.log('Initializing PhishShield Options');
        
        // Check if this is first run (welcome parameter)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('welcome') === 'true') {
            this.showWelcomeSection();
        }

        // Load current settings
        await this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load trust lists
        await this.loadTrustLists();
        
        // Load statistics
        await this.loadStatistics();
        
        // Test initial API connection
        this.testApiConnection();
    }

    showWelcomeSection() {
        const welcomeSection = document.getElementById('welcome-section');
        if (welcomeSection) {
            welcomeSection.classList.remove('hidden');
        }
    }

    async loadSettings() {
        try {
            this.settings = await chrome.storage.sync.get(null);
            
            // Set default values
            const defaults = {
                apiUrl: 'http://localhost:8000',
                autoScan: true,
                showNotifications: true,
                riskThreshold: 'medium',
                blockSuspiciousLinks: false,
                debugMode: false,
                analytics: true
            };

            // Merge with defaults
            this.settings = { ...defaults, ...this.settings };
            
            // Update UI
            this.updateUI();
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('Error loading settings', 'error');
        }
    }

    updateUI() {
        // Update form fields
        document.getElementById('api-url').value = this.settings.apiUrl || '';
        document.getElementById('auto-scan').checked = this.settings.autoScan ?? true;
        document.getElementById('show-notifications').checked = this.settings.showNotifications ?? true;
        document.getElementById('risk-threshold').value = this.settings.riskThreshold || 'medium';
        document.getElementById('block-suspicious-links').checked = this.settings.blockSuspiciousLinks ?? false;
        document.getElementById('debug-mode').checked = this.settings.debugMode ?? false;
        document.getElementById('analytics').checked = this.settings.analytics ?? true;
    }

    setupEventListeners() {
        // API Configuration
        document.getElementById('api-url').addEventListener('change', (e) => {
            this.saveSetting('apiUrl', e.target.value);
        });

        document.getElementById('test-connection').addEventListener('click', () => {
            this.testApiConnection();
        });

        // Security Settings
        document.getElementById('auto-scan').addEventListener('change', (e) => {
            this.saveSetting('autoScan', e.target.checked);
        });

        document.getElementById('show-notifications').addEventListener('change', (e) => {
            this.saveSetting('showNotifications', e.target.checked);
        });

        document.getElementById('risk-threshold').addEventListener('change', (e) => {
            this.saveSetting('riskThreshold', e.target.value);
        });

        document.getElementById('block-suspicious-links').addEventListener('change', (e) => {
            this.saveSetting('blockSuspiciousLinks', e.target.checked);
        });

        // Trust Lists
        document.getElementById('add-whitelist').addEventListener('click', () => {
            this.addToTrustList('whitelist');
        });

        document.getElementById('add-blacklist').addEventListener('click', () => {
            this.addToTrustList('blacklist');
        });

        // OAuth
        document.getElementById('gmail-oauth').addEventListener('click', () => {
            this.handleOAuth('google');
        });

        document.getElementById('outlook-oauth').addEventListener('click', () => {
            this.handleOAuth('microsoft');
        });

        // Advanced Settings
        document.getElementById('debug-mode').addEventListener('change', (e) => {
            this.saveSetting('debugMode', e.target.checked);
        });

        document.getElementById('analytics').addEventListener('change', (e) => {
            this.saveSetting('analytics', e.target.checked);
        });

        document.getElementById('export-settings').addEventListener('click', () => {
            this.exportSettings();
        });

        document.getElementById('import-settings').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importSettings(e.target.files[0]);
        });

        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetSettings();
        });

        // Enter key handlers for trust list inputs
        document.getElementById('whitelist-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addToTrustList('whitelist');
            }
        });

        document.getElementById('blacklist-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addToTrustList('blacklist');
            }
        });
    }

    async saveSetting(key, value) {
        try {
            this.settings[key] = value;
            await chrome.storage.sync.set({ [key]: value });
            this.showToast('Settings saved', 'success');
        } catch (error) {
            console.error('Error saving setting:', error);
            this.showToast('Error saving settings', 'error');
        }
    }

    async testApiConnection() {
        const button = document.getElementById('test-connection');
        const status = document.getElementById('connection-status');
        const apiUrl = this.settings.apiUrl || 'http://localhost:8000';

        button.disabled = true;
        button.textContent = 'Testing...';
        status.textContent = 'Testing...';
        status.className = 'status-indicator testing';

        try {
            const response = await fetch(`${apiUrl}/health`);
            
            if (response.ok) {
                const data = await response.json();
                status.textContent = `✅ Connected (v${data.version})`;
                status.className = 'status-indicator success';
                this.showToast('API connection successful', 'success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('API connection test failed:', error);
            status.textContent = '❌ Connection failed';
            status.className = 'status-indicator error';
            this.showToast(`API connection failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Test Connection';
        }
    }

    async addToTrustList(type) {
        const inputId = `${type}-input`;
        const input = document.getElementById(inputId);
        const email = input.value.trim();

        if (!email) {
            this.showToast('Please enter an email address or domain', 'warning');
            return;
        }

        if (!this.isValidEmailOrDomain(email)) {
            this.showToast('Please enter a valid email address or domain', 'warning');
            return;
        }

        try {
            const response = await this.sendMessage({
                type: 'ADD_TO_TRUSTLIST',
                listType: type,
                email: email
            });

            if (response.success) {
                input.value = '';
                await this.loadTrustLists();
                this.showToast(`Added to ${type}`, 'success');
            } else {
                throw new Error(response.error || 'Failed to add to trust list');
            }
        } catch (error) {
            console.error('Error adding to trust list:', error);
            this.showToast(`Error adding to ${type}: ${error.message}`, 'error');
        }
    }

    async loadTrustLists() {
        try {
            const response = await this.sendMessage({
                type: 'GET_TRUSTLISTS'
            });

            if (response.success) {
                this.renderTrustList('whitelist', response.data.whitelist || []);
                this.renderTrustList('blacklist', response.data.blacklist || []);
            }
        } catch (error) {
            console.error('Error loading trust lists:', error);
        }
    }

    renderTrustList(type, items) {
        const listElement = document.getElementById(`${type}-items`);
        listElement.innerHTML = '';

        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="trust-item-email">${item.email_address}</span>
                <button class="remove-btn" data-type="${type}" data-email="${item.email_address}">
                    Remove
                </button>
            `;
            listElement.appendChild(li);
        });

        // Add event listeners to remove buttons
        listElement.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeFromTrustList(
                    e.target.dataset.type,
                    e.target.dataset.email
                );
            });
        });
    }

    async removeFromTrustList(type, email) {
        try {
            const response = await this.sendMessage({
                type: 'REMOVE_FROM_TRUSTLIST',
                listType: type,
                email: email
            });

            if (response.success) {
                await this.loadTrustLists();
                this.showToast(`Removed from ${type}`, 'success');
            } else {
                throw new Error(response.error || 'Failed to remove from trust list');
            }
        } catch (error) {
            console.error('Error removing from trust list:', error);
            this.showToast(`Error removing from ${type}: ${error.message}`, 'error');
        }
    }

    async handleOAuth(provider) {
        const button = document.getElementById(`${provider === 'google' ? 'gmail' : 'outlook'}-oauth`);
        const status = document.getElementById(`${provider === 'google' ? 'gmail' : 'outlook'}-status`);

        button.disabled = true;
        button.textContent = 'Connecting...';

        try {
            const response = await this.sendMessage({
                type: 'OAUTH_AUTHORIZE',
                provider: provider
            });

            if (response.success) {
                status.textContent = '✅ Connected';
                status.className = 'status-indicator success';
                button.textContent = 'Disconnect';
                this.showToast(`${provider === 'google' ? 'Gmail' : 'Outlook'} connected successfully`, 'success');
            } else {
                throw new Error(response.error || 'OAuth failed');
            }
        } catch (error) {
            console.error('OAuth error:', error);
            status.textContent = '❌ Failed';
            status.className = 'status-indicator error';
            this.showToast(`${provider === 'google' ? 'Gmail' : 'Outlook'} connection failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            if (button.textContent === 'Connecting...') {
                button.textContent = provider === 'google' ? 'Connect Gmail' : 'Connect Outlook';
            }
        }
    }

    async loadStatistics() {
        try {
            const response = await this.sendMessage({
                type: 'GET_STATISTICS'
            });

            if (response.success) {
                const stats = response.data;
                document.getElementById('total-scans').textContent = stats.totalScans || 0;
                document.getElementById('threats-blocked').textContent = stats.threatsBlocked || 0;
                document.getElementById('avg-risk-score').textContent = stats.avgRiskScore || 0;
                document.getElementById('last-scan').textContent = stats.lastScan || 'Never';
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    exportSettings() {
        const settingsData = {
            ...this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const dataStr = JSON.stringify(settingsData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `phishshield-settings-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showToast('Settings exported', 'success');
    }

    async importSettings(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const settingsData = JSON.parse(text);

            // Validate settings structure
            if (!settingsData.version) {
                throw new Error('Invalid settings file format');
            }

            // Remove metadata
            delete settingsData.exportDate;
            delete settingsData.version;

            // Save settings
            await chrome.storage.sync.set(settingsData);
            this.settings = { ...this.settings, ...settingsData };
            
            // Update UI
            this.updateUI();
            
            this.showToast('Settings imported successfully', 'success');
        } catch (error) {
            console.error('Error importing settings:', error);
            this.showToast('Error importing settings: ' + error.message, 'error');
        }
    }

    async resetSettings() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            return;
        }

        try {
            await chrome.storage.sync.clear();
            await this.loadSettings();
            this.showToast('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showToast('Error resetting settings', 'error');
        }
    }

    isValidEmailOrDomain(input) {
        // Check if it's a valid email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(input)) return true;

        // Check if it's a valid domain
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})+$/;
        if (domainRegex.test(input)) return true;

        // Check if it's a wildcard domain pattern
        const wildcardRegex = /^\*@[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})+$/;
        return wildcardRegex.test(input);
    }

    async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PhishShieldOptions();
});