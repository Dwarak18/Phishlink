/**
 * PhishShield React Popup Component
 * Main UI for the browser extension popup
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Risk level colors and icons
const RISK_CONFIG = {
    safe: { color: '#4CAF50', icon: '✅', label: 'Safe' },
    low: { color: '#FF9800', icon: '⚠️', label: 'Low Risk' },
    medium: { color: '#FF5722', icon: '🚨', label: 'Medium Risk' },
    high: { color: '#F44336', icon: '🔴', label: 'High Risk' },
    critical: { color: '#B71C1C', icon: '💀', label: 'Critical Risk' }
};

const PhishShieldPopup = () => {
    const [analysisResult, setAnalysisResult] = useState(null);
    const [emailData, setEmailData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState({});
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        initializePopup();
    }, []);

    const initializePopup = async () => {
        try {
            setLoading(true);
            
            // Get settings first
            const settingsResponse = await sendMessage({ type: 'GET_SETTINGS' });
            if (settingsResponse.success) {
                setSettings(settingsResponse.data);
            }

            // Check if we're on an email page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!isEmailPage(tab.url)) {
                setError('Please open Gmail or Outlook to scan emails');
                setLoading(false);
                return;
            }

            // Get current email data
            const emailResponse = await sendMessage({ type: 'GET_CURRENT_EMAIL' });
            
            if (!emailResponse.success) {
                setError(emailResponse.error || 'Could not extract email data');
                setLoading(false);
                return;
            }

            const currentEmailData = emailResponse.data;
            setEmailData(currentEmailData);

            // Analyze the email
            const analysisResponse = await sendMessage({
                type: 'ANALYZE_EMAIL',
                emailData: currentEmailData
            });

            if (analysisResponse.success) {
                setAnalysisResult(analysisResponse.data);
            } else {
                setError(analysisResponse.error || 'Analysis failed');
            }

        } catch (err) {
            console.error('Popup initialization error:', err);
            setError('Failed to initialize PhishShield');
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = (message) => {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    };

    const isEmailPage = (url) => {
        return url && (
            url.includes('mail.google.com') || 
            url.includes('outlook.live.com') ||
            url.includes('outlook.office.com') ||
            url.includes('outlook.office365.com')
        );
    };

    const handleFeedback = async (isPhishing, feedbackType) => {
        try {
            if (!emailData?.message_id) {
                alert('Cannot submit feedback: No message ID available');
                return;
            }

            const feedback = {
                message_id: emailData.message_id,
                is_phishing: isPhishing,
                feedback_type: feedbackType,
                comments: null
            };

            const response = await sendMessage({
                type: 'SUBMIT_FEEDBACK',
                feedback
            });

            if (response.success) {
                alert('Thank you for your feedback!');
            } else {
                alert('Failed to submit feedback');
            }
        } catch (err) {
            console.error('Feedback submission error:', err);
            alert('Error submitting feedback');
        }
    };

    const formatRiskScore = (score) => {
        return Math.round(score);
    };

    const getRiskConfig = (riskLevel) => {
        return RISK_CONFIG[riskLevel] || RISK_CONFIG.safe;
    };

    if (loading) {
        return (
            <div className="popup-container">
                <div className="header">
                    <img src="../icons/icon32.png" alt="PhishShield" className="logo" />
                    <h1>PhishShield</h1>
                </div>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Analyzing email security...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="popup-container">
                <div className="header">
                    <img src="../icons/icon32.png" alt="PhishShield" className="logo" />
                    <h1>PhishShield</h1>
                </div>
                <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <h3>Unable to Scan</h3>
                    <p>{error}</p>
                    <button onClick={initializePopup} className="retry-button">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const riskConfig = getRiskConfig(analysisResult?.risk_level);

    return (
        <div className="popup-container">
            <div className="header">
                <img src="../icons/icon32.png" alt="PhishShield" className="logo" />
                <h1>PhishShield</h1>
                <button 
                    className="settings-button"
                    onClick={() => chrome.runtime.openOptionsPage()}
                    title="Open Settings"
                >
                    ⚙️
                </button>
            </div>

            {analysisResult && (
                <div className="analysis-results">
                    {/* Risk Score Display */}
                    <div className="risk-summary" style={{ borderColor: riskConfig.color }}>
                        <div className="risk-icon" style={{ color: riskConfig.color }}>
                            {riskConfig.icon}
                        </div>
                        <div className="risk-info">
                            <h2 style={{ color: riskConfig.color }}>
                                {riskConfig.label}
                            </h2>
                            <div className="risk-score">
                                Risk Score: {formatRiskScore(analysisResult.risk_score)}/100
                            </div>
                        </div>
                    </div>

                    {/* Email Info */}
                    <div className="email-info">
                        <div className="email-field">
                            <strong>From:</strong> 
                            <span className="email-value">{emailData?.from_address || 'Unknown'}</span>
                        </div>
                        <div className="email-field">
                            <strong>Subject:</strong> 
                            <span className="email-value">{emailData?.subject || 'No subject'}</span>
                        </div>
                    </div>

                    {/* Flags Summary */}
                    {analysisResult.flags.length > 0 && (
                        <div className="flags-summary">
                            <h3>Security Issues Found ({analysisResult.flags.length})</h3>
                            <div className="flags-list">
                                {analysisResult.flags.slice(0, 3).map((flag, index) => (
                                    <div key={index} className={`flag-item severity-${flag.severity}`}>
                                        <span className="flag-type">{flag.severity.toUpperCase()}</span>
                                        <span className="flag-description">{flag.description}</span>
                                    </div>
                                ))}
                                {analysisResult.flags.length > 3 && (
                                    <div className="more-flags">
                                        +{analysisResult.flags.length - 3} more issues
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {analysisResult.recommendations.length > 0 && (
                        <div className="recommendations">
                            <h3>Security Recommendations</h3>
                            <ul>
                                {analysisResult.recommendations.slice(0, 3).map((rec, index) => (
                                    <li key={index}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button 
                            className="details-button"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                        
                        <div className="feedback-buttons">
                            <button 
                                className="feedback-safe"
                                onClick={() => handleFeedback(false, 'mark_safe')}
                                title="Mark as safe"
                            >
                                ✅ Safe
                            </button>
                            <button 
                                className="feedback-phishing"
                                onClick={() => handleFeedback(true, 'report_phishing')}
                                title="Report as phishing"
                            >
                                🚨 Phishing
                            </button>
                        </div>
                    </div>

                    {/* Detailed View */}
                    {showDetails && (
                        <div className="details-section">
                            <div className="analysis-stats">
                                <p><strong>Analysis Time:</strong> {(analysisResult.analysis_time * 1000).toFixed(0)}ms</p>
                                <p><strong>Whitelisted:</strong> {analysisResult.whitelisted ? 'Yes' : 'No'}</p>
                                <p><strong>Blacklisted:</strong> {analysisResult.blacklisted ? 'Yes' : 'No'}</p>
                            </div>

                            {/* All Flags */}
                            <div className="all-flags">
                                <h4>All Detected Issues:</h4>
                                {analysisResult.flags.map((flag, index) => (
                                    <div key={index} className={`flag-detail severity-${flag.severity}`}>
                                        <div className="flag-header">
                                            <span className="flag-severity">{flag.severity.toUpperCase()}</span>
                                            <span className="flag-type-detail">{flag.type}</span>
                                        </div>
                                        <p className="flag-description-detail">{flag.description}</p>
                                        {flag.details && (
                                            <p className="flag-details">{flag.details}</p>
                                        )}
                                    </div>
                                )) || <p>No issues detected</p>}
                            </div>

                            {/* All Recommendations */}
                            <div className="all-recommendations">
                                <h4>All Recommendations:</h4>
                                <ul>
                                    {analysisResult.recommendations.map((rec, index) => (
                                        <li key={index}>{rec}</li>
                                    )) || <li>No specific recommendations</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="footer">
                <p>Protected by PhishShield v1.0</p>
            </div>
        </div>
    );
};

// Initialize React app
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<PhishShieldPopup />);
}