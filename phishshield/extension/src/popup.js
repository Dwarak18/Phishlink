/**
 * Popup JavaScript entry point (non-React fallback)
 * This file loads when React is not available or as a fallback
 */

// Simple vanilla JavaScript popup implementation
class PhishShieldPopupVanilla {
    constructor() {
        this.initializePopup();
    }

    async initializePopup() {
        try {
            // Check if we're on an email page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!this.isEmailPage(tab.url)) {
                this.showError('Please open Gmail or Outlook to scan emails');
                return;
            }

            this.showLoading();

            // Get current email data and analyze
            const response = await this.sendMessage({ type: 'GET_CURRENT_EMAIL' });
            
            if (!response.success) {
                this.showError(response.error || 'Could not extract email data');
                return;
            }

            // Analyze the email
            const analysisResponse = await this.sendMessage({
                type: 'ANALYZE_EMAIL',
                emailData: response.data
            });

            if (analysisResponse.success) {
                this.showResults(response.data, analysisResponse.data);
            } else {
                this.showError(analysisResponse.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Popup error:', error);
            this.showError('Failed to initialize PhishShield');
        }
    }

    sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    isEmailPage(url) {
        return url && (
            url.includes('mail.google.com') || 
            url.includes('outlook.live.com') ||
            url.includes('outlook.office.com') ||
            url.includes('outlook.office365.com')
        );
    }

    showLoading() {
        document.getElementById('root').innerHTML = `
            <div class="popup-container">
                <div class="header">
                    <img src="../icons/icon32.png" alt="PhishShield" class="logo" />
                    <h1>PhishShield</h1>
                </div>
                <div class="loading-container">
                    <div class="spinner"></div>
                    <p>Analyzing email security...</p>
                </div>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('root').innerHTML = `
            <div class="popup-container">
                <div class="header">
                    <img src="../icons/icon32.png" alt="PhishShield" class="logo" />
                    <h1>PhishShield</h1>
                </div>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h3>Unable to Scan</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="retry-button">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }

    showResults(emailData, analysisResult) {
        const riskConfig = this.getRiskConfig(analysisResult.risk_level);
        
        document.getElementById('root').innerHTML = `
            <div class="popup-container">
                <div class="header">
                    <img src="../icons/icon32.png" alt="PhishShield" class="logo" />
                    <h1>PhishShield</h1>
                </div>
                
                <div class="analysis-results">
                    <div class="risk-summary" style="border-color: ${riskConfig.color}">
                        <div class="risk-icon" style="color: ${riskConfig.color}">
                            ${riskConfig.icon}
                        </div>
                        <div class="risk-info">
                            <h2 style="color: ${riskConfig.color}">
                                ${riskConfig.label}
                            </h2>
                            <div class="risk-score">
                                Risk Score: ${Math.round(analysisResult.risk_score)}/100
                            </div>
                        </div>
                    </div>

                    <div class="email-info">
                        <div class="email-field">
                            <strong>From:</strong> 
                            <span class="email-value">${emailData.from_address || 'Unknown'}</span>
                        </div>
                        <div class="email-field">
                            <strong>Subject:</strong> 
                            <span class="email-value">${emailData.subject || 'No subject'}</span>
                        </div>
                    </div>

                    ${this.renderFlags(analysisResult.flags)}
                    ${this.renderRecommendations(analysisResult.recommendations)}

                    <div class="action-buttons">
                        <div class="feedback-buttons">
                            <button class="feedback-safe" onclick="phishShieldPopup.submitFeedback(false, 'mark_safe')">
                                ✅ Safe
                            </button>
                            <button class="feedback-phishing" onclick="phishShieldPopup.submitFeedback(true, 'report_phishing')">
                                🚨 Phishing
                            </button>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <p>Protected by PhishShield v1.0</p>
                </div>
            </div>
        `;

        // Store data for feedback
        this.currentEmailData = emailData;
    }

    getRiskConfig(riskLevel) {
        const configs = {
            safe: { color: '#4CAF50', icon: '✅', label: 'Safe' },
            low: { color: '#FF9800', icon: '⚠️', label: 'Low Risk' },
            medium: { color: '#FF5722', icon: '🚨', label: 'Medium Risk' },
            high: { color: '#F44336', icon: '🔴', label: 'High Risk' },
            critical: { color: '#B71C1C', icon: '💀', label: 'Critical Risk' }
        };
        return configs[riskLevel] || configs.safe;
    }

    renderFlags(flags) {
        if (!flags || flags.length === 0) return '';

        return `
            <div class="flags-summary">
                <h3>Security Issues Found (${flags.length})</h3>
                <div class="flags-list">
                    ${flags.slice(0, 3).map(flag => `
                        <div class="flag-item severity-${flag.severity}">
                            <span class="flag-type">${flag.severity.toUpperCase()}</span>
                            <span class="flag-description">${flag.description}</span>
                        </div>
                    `).join('')}
                    ${flags.length > 3 ? `
                        <div class="more-flags">
                            +${flags.length - 3} more issues
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) return '';

        return `
            <div class="recommendations">
                <h3>Security Recommendations</h3>
                <ul>
                    ${recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    async submitFeedback(isPhishing, feedbackType) {
        try {
            if (!this.currentEmailData?.message_id) {
                alert('Cannot submit feedback: No message ID available');
                return;
            }

            const feedback = {
                message_id: this.currentEmailData.message_id,
                is_phishing: isPhishing,
                feedback_type: feedbackType,
                comments: null
            };

            const response = await this.sendMessage({
                type: 'SUBMIT_FEEDBACK',
                feedback
            });

            if (response.success) {
                alert('Thank you for your feedback!');
            } else {
                alert('Failed to submit feedback');
            }
        } catch (error) {
            console.error('Feedback error:', error);
            alert('Error submitting feedback');
        }
    }
}

// Check if React is available, if not use vanilla JS
let phishShieldPopup;

// Try to load React version first
try {
    // This will fail if React components aren't loaded
    if (typeof React !== 'undefined') {
        // React version will handle itself
        console.log('Loading React popup');
    } else {
        throw new Error('React not available');
    }
} catch (error) {
    // Fallback to vanilla JS
    console.log('Loading vanilla JS popup');
    document.addEventListener('DOMContentLoaded', () => {
        phishShieldPopup = new PhishShieldPopupVanilla();
    });
}

// Make sure popup is initialized even if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!phishShieldPopup) {
            phishShieldPopup = new PhishShieldPopupVanilla();
        }
    });
} else {
    if (!phishShieldPopup) {
        phishShieldPopup = new PhishShieldPopupVanilla();
    }
}