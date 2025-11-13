/**
 * Background service worker for PhishShield extension.
 * Handles API communication, OAuth flows, and message passing.
 */

const API_BASE_URL = 'http://localhost:8000'; // Change to your production API URL

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('PhishShield extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            apiUrl: API_BASE_URL,
            autoScan: true,
            showNotifications: true,
            riskThreshold: 'medium'
        });
        
        // Open welcome page
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/options.html?welcome=true')
        });
    }
});

// Message handler for content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.type) {
        case 'ANALYZE_EMAIL':
            handleEmailAnalysis(message.emailData)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep message channel open for async response
            
        case 'GET_CURRENT_EMAIL':
            getCurrentEmailData(sender.tab.id)
                .then(emailData => sendResponse({ success: true, data: emailData }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'SUBMIT_FEEDBACK':
            submitFeedback(message.feedback)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'OAUTH_AUTHORIZE':
            handleOAuthFlow(message.provider)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'GET_SETTINGS':
            chrome.storage.sync.get(null, (settings) => {
                sendResponse({ success: true, data: settings });
            });
            return true;
            
        case 'UPDATE_SETTINGS':
            chrome.storage.sync.set(message.settings, () => {
                sendResponse({ success: true });
            });
            return true;
            
        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});

/**
 * Analyze email using the PhishShield API
 */
async function handleEmailAnalysis(emailData) {
    try {
        const settings = await getSettings();
        const apiUrl = settings.apiUrl || API_BASE_URL;
        
        const response = await fetch(`${apiUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Store result for popup access
        await chrome.storage.local.set({
            [`analysis_${emailData.message_id || Date.now()}`]: {
                result,
                emailData,
                timestamp: Date.now()
            }
        });
        
        // Show notification if enabled and high risk
        if (settings.showNotifications && result.risk_level in ['high', 'critical']) {
            showRiskNotification(result);
        }
        
        // Update extension badge
        updateExtensionBadge(result.risk_level);
        
        return result;
        
    } catch (error) {
        console.error('Email analysis failed:', error);
        throw error;
    }
}

/**
 * Get current email data from active tab
 */
async function getCurrentEmailData(tabId) {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            function: extractCurrentEmail
        });
        
        return result.result;
    } catch (error) {
        console.error('Failed to get current email:', error);
        throw new Error('Could not extract email data from current page');
    }
}

/**
 * Function injected into page to extract email data
 */
function extractCurrentEmail() {
    // This function runs in the page context
    if (window.phishShieldExtractor) {
        return window.phishShieldExtractor.getCurrentEmail();
    }
    throw new Error('Email extractor not available');
}

/**
 * Submit user feedback to API
 */
async function submitFeedback(feedback) {
    try {
        const settings = await getSettings();
        const apiUrl = settings.apiUrl || API_BASE_URL;
        
        const response = await fetch(`${apiUrl}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(feedback)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to submit feedback: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Feedback submission failed:', error);
        throw error;
    }
}

/**
 * Handle OAuth flow for Gmail/Microsoft
 */
async function handleOAuthFlow(provider) {
    try {
        if (provider === 'google') {
            return await handleGoogleOAuth();
        } else if (provider === 'microsoft') {
            return await handleMicrosoftOAuth();
        } else {
            throw new Error('Unsupported OAuth provider');
        }
    } catch (error) {
        console.error('OAuth flow failed:', error);
        throw error;
    }
}

/**
 * Handle Google OAuth flow
 */
async function handleGoogleOAuth() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            // Store token securely
            chrome.storage.local.set({
                googleAuthToken: token,
                googleAuthExpiry: Date.now() + (3600 * 1000) // 1 hour
            });
            
            resolve({ token, provider: 'google' });
        });
    });
}

/**
 * Handle Microsoft OAuth flow (requires custom implementation)
 */
async function handleMicrosoftOAuth() {
    // This would require a custom OAuth flow implementation
    // For now, return a placeholder
    throw new Error('Microsoft OAuth not yet implemented');
}

/**
 * Show risk notification
 */
function showRiskNotification(analysisResult) {
    const riskEmoji = {
        'low': '⚠️',
        'medium': '🚨',
        'high': '🔴',
        'critical': '💀'
    };
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `${riskEmoji[analysisResult.risk_level]} PhishShield Alert`,
        message: `High risk email detected! Risk level: ${analysisResult.risk_level.toUpperCase()}`,
        priority: 2
    });
}

/**
 * Update extension badge
 */
function updateExtensionBadge(riskLevel) {
    const badgeConfig = {
        'safe': { text: '✓', color: '#4CAF50' },
        'low': { text: '!', color: '#FF9800' },
        'medium': { text: '!!', color: '#FF5722' },
        'high': { text: '!!!', color: '#F44336' },
        'critical': { text: '💀', color: '#B71C1C' }
    };
    
    const config = badgeConfig[riskLevel] || badgeConfig['safe'];
    
    chrome.action.setBadgeText({ text: config.text });
    chrome.action.setBadgeBackgroundColor({ color: config.color });
    
    // Clear badge after 10 seconds
    setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
    }, 10000);
}

/**
 * Get extension settings
 */
async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(null, (settings) => {
            resolve(settings);
        });
    });
}

/**
 * Tab update listener to clear old analysis data
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Clear badge when navigating away from email
        if (!tab.url.includes('mail.google.com') && !tab.url.includes('outlook')) {
            chrome.action.setBadgeText({ text: '' });
        }
    }
});

/**
 * Cleanup old analysis data (run daily)
 */
chrome.alarms.create('cleanupAnalysisData', { periodInMinutes: 1440 }); // 24 hours

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupAnalysisData') {
        cleanupOldAnalysisData();
    }
});

async function cleanupOldAnalysisData() {
    const storage = await chrome.storage.local.get(null);
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const keysToRemove = Object.keys(storage).filter(key => {
        if (key.startsWith('analysis_')) {
            const data = storage[key];
            return data.timestamp < cutoffTime;
        }
        return false;
    });
    
    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old analysis records`);
    }
}

// Health check interval
setInterval(async () => {
    try {
        const settings = await getSettings();
        const apiUrl = settings.apiUrl || API_BASE_URL;
        
        const response = await fetch(`${apiUrl}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            console.warn('API health check failed:', response.status);
        }
    } catch (error) {
        console.warn('API health check error:', error.message);
    }
}, 5 * 60 * 1000); // Every 5 minutes

console.log('PhishShield background service worker loaded');