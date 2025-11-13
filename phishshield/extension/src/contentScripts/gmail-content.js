/**
 * Gmail Content Script for PhishShield
 * Extracts email data from Gmail interface and provides scanning capabilities
 */

(function() {
    'use strict';

    console.log('PhishShield Gmail content script loaded');

    class GmailExtractor {
        constructor() {
            this.isGmail = window.location.hostname === 'mail.google.com';
            this.currentEmailData = null;
            this.observer = null;
            this.scanButton = null;
            
            if (this.isGmail) {
                this.initialize();
            }
        }

        initialize() {
            // Wait for Gmail to load
            this.waitForGmail().then(() => {
                this.setupEmailDetection();
                this.injectScanButton();
                console.log('PhishShield Gmail integration ready');
            });

            // Make extractor available globally for background script
            window.phishShieldExtractor = this;
        }

        async waitForGmail() {
            return new Promise((resolve) => {
                const checkGmail = () => {
                    if (document.querySelector('[role="main"]') || document.querySelector('.nH')) {
                        resolve();
                    } else {
                        setTimeout(checkGmail, 100);
                    }
                };
                checkGmail();
            });
        }

        setupEmailDetection() {
            // Watch for navigation changes in Gmail
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Check if we're viewing an email
                        if (this.isEmailView()) {
                            this.handleEmailView();
                        }
                    }
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Initial check
            if (this.isEmailView()) {
                this.handleEmailView();
            }
        }

        isEmailView() {
            // Check if we're in an email conversation view
            return !!(
                document.querySelector('[data-message-id]') || 
                document.querySelector('.ii.gt') ||
                document.querySelector('[role="listitem"] [email]')
            );
        }

        handleEmailView() {
            setTimeout(() => {
                this.updateScanButton();
            }, 500); // Give Gmail time to load content
        }

        getCurrentEmail() {
            if (!this.isEmailView()) {
                throw new Error('Not viewing an email');
            }

            const emailData = this.extractEmailData();
            this.currentEmailData = emailData;
            return emailData;
        }

        extractEmailData() {
            let emailData = {
                subject: '',
                from: '',
                to: [],
                body: '',
                links: [],
                headers: null,
                attachments: [],
                message_id: null
            };

            try {
                // Extract subject
                const subjectElement = document.querySelector('[data-thread-perm-id] h2') ||
                                    document.querySelector('.hP') ||
                                    document.querySelector('[data-legacy-thread-id] span[title]');
                
                if (subjectElement) {
                    emailData.subject = subjectElement.textContent || subjectElement.title || '';
                }

                // Extract sender information
                const fromElement = document.querySelector('[email]') ||
                                  document.querySelector('.go span[email]') ||
                                  document.querySelector('.gD') ||
                                  document.querySelector('.qu .go span');

                if (fromElement) {
                    emailData.from = fromElement.getAttribute('email') || 
                                   fromElement.textContent ||
                                   fromElement.title || '';
                }

                // Extract recipients
                const toElements = document.querySelectorAll('.g2 [email]') ||
                                 document.querySelectorAll('.hb [email]');
                
                emailData.to = Array.from(toElements).map(el => 
                    el.getAttribute('email') || el.textContent || ''
                ).filter(email => email);

                // Extract message body
                const bodyElements = document.querySelectorAll('.ii.gt div') ||
                                   document.querySelectorAll('[data-message-id] .ii.gt') ||
                                   document.querySelectorAll('.adn.ads .ii.gt');

                let bodyText = '';
                bodyElements.forEach(el => {
                    const text = el.textContent || '';
                    if (text.trim() && !text.includes('Gmail')) {
                        bodyText += text + '\n';
                    }
                });

                emailData.body = bodyText.trim();

                // Extract links
                const linkElements = document.querySelectorAll('.ii.gt a[href]');
                emailData.links = Array.from(linkElements)
                    .map(link => link.href)
                    .filter(href => href && !href.startsWith('mailto:'))
                    .slice(0, 20); // Limit to first 20 links

                // Extract attachment info
                const attachmentElements = document.querySelectorAll('.aZo span[title]') ||
                                        document.querySelectorAll('.aS2 span[title]');
                
                emailData.attachments = Array.from(attachmentElements)
                    .map(el => el.title || el.textContent || '')
                    .filter(name => name);

                // Try to get message ID
                const messageElement = document.querySelector('[data-message-id]');
                if (messageElement) {
                    emailData.message_id = messageElement.getAttribute('data-message-id');
                }

                // Generate fallback message ID if not found
                if (!emailData.message_id) {
                    emailData.message_id = `gmail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }

                console.log('Extracted Gmail data:', emailData);
                return emailData;

            } catch (error) {
                console.error('Error extracting Gmail data:', error);
                throw new Error('Failed to extract email data');
            }
        }

        injectScanButton() {
            // Try multiple locations for the scan button
            const insertLocations = [
                () => document.querySelector('.ar9.T-I-J3'),  // More actions menu area
                () => document.querySelector('.T-I.T-I-atl'),  // Toolbar area
                () => document.querySelector('.aio'),          // Top toolbar
                () => document.querySelector('.nH .ar')        // Header area
            ];

            for (const getLocation of insertLocations) {
                const location = getLocation();
                if (location) {
                    this.createScanButton(location);
                    break;
                }
            }
        }

        createScanButton(parentElement) {
            // Remove existing button
            const existingButton = document.querySelector('#phishshield-scan-button');
            if (existingButton) {
                existingButton.remove();
            }

            // Create scan button
            this.scanButton = document.createElement('button');
            this.scanButton.id = 'phishshield-scan-button';
            this.scanButton.innerHTML = '🛡️ Scan Email';
            this.scanButton.className = 'phishshield-scan-btn';
            this.scanButton.title = 'Scan this email for phishing threats';
            
            this.scanButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.scanCurrentEmail();
            });

            // Insert button
            if (parentElement.tagName === 'DIV') {
                parentElement.appendChild(this.scanButton);
            } else {
                parentElement.parentElement.insertBefore(this.scanButton, parentElement.nextSibling);
            }
        }

        updateScanButton() {
            if (!this.scanButton || !document.body.contains(this.scanButton)) {
                this.injectScanButton();
            }

            if (this.scanButton) {
                this.scanButton.disabled = !this.isEmailView();
                this.scanButton.style.opacity = this.isEmailView() ? '1' : '0.5';
            }
        }

        async scanCurrentEmail() {
            if (!this.isEmailView()) {
                this.showNotification('Please select an email to scan', 'warning');
                return;
            }

            try {
                this.scanButton.disabled = true;
                this.scanButton.innerHTML = '🔄 Scanning...';

                const emailData = this.getCurrentEmail();
                
                // Send to background script for analysis
                const response = await this.sendMessage({
                    type: 'ANALYZE_EMAIL',
                    emailData: emailData
                });

                if (response.success) {
                    this.showAnalysisResult(response.data);
                } else {
                    throw new Error(response.error || 'Analysis failed');
                }

            } catch (error) {
                console.error('Scan error:', error);
                this.showNotification('Scan failed: ' + error.message, 'error');
            } finally {
                this.scanButton.disabled = false;
                this.scanButton.innerHTML = '🛡️ Scan Email';
            }
        }

        showAnalysisResult(result) {
            const riskColors = {
                safe: '#4CAF50',
                low: '#FF9800', 
                medium: '#FF5722',
                high: '#F44336',
                critical: '#B71C1C'
            };

            const message = `
                PhishShield Analysis Complete!
                
                Risk Level: ${result.risk_level.toUpperCase()}
                Risk Score: ${Math.round(result.risk_score)}/100
                Issues Found: ${result.flags.length}
                
                ${result.recommendations.slice(0, 2).join('\n')}
            `;

            this.showNotification(message, result.risk_level);

            // Also show in-page overlay for detailed results
            this.showDetailedResults(result);
        }

        showDetailedResults(result) {
            // Remove existing overlay
            const existingOverlay = document.querySelector('#phishshield-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            const riskColors = {
                safe: '#4CAF50',
                low: '#FF9800',
                medium: '#FF5722', 
                high: '#F44336',
                critical: '#B71C1C'
            };

            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'phishshield-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                max-height: 500px;
                background: white;
                border: 3px solid ${riskColors[result.risk_level]};
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
                font-family: Arial, sans-serif;
            `;

            overlay.innerHTML = `
                <div style="padding: 15px; border-bottom: 1px solid #eee; background: ${riskColors[result.risk_level]}; color: white;">
                    <h3 style="margin: 0; font-size: 16px;">🛡️ PhishShield Analysis</h3>
                    <button id="phishshield-close" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <h2 style="color: ${riskColors[result.risk_level]}; margin: 5px 0;">
                            ${result.risk_level.toUpperCase()} RISK
                        </h2>
                        <div style="font-size: 18px; font-weight: bold;">
                            Score: ${Math.round(result.risk_score)}/100
                        </div>
                    </div>
                    
                    ${result.flags.length > 0 ? `
                        <div style="margin: 10px 0;">
                            <strong>Issues Found (${result.flags.length}):</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${result.flags.slice(0, 5).map(flag => 
                                    `<li><strong>${flag.severity.toUpperCase()}:</strong> ${flag.description}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${result.recommendations.length > 0 ? `
                        <div style="margin: 10px 0;">
                            <strong>Recommendations:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${result.recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 15px; text-align: center;">
                        <button id="phishshield-popup" style="
                            background: #1976D2; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 4px; 
                            cursor: pointer;
                            margin-right: 10px;
                        ">View Details</button>
                        <button id="phishshield-dismiss" style="
                            background: #666; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 4px; 
                            cursor: pointer;
                        ">Dismiss</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Add event listeners
            document.getElementById('phishshield-close').onclick = () => overlay.remove();
            document.getElementById('phishshield-dismiss').onclick = () => overlay.remove();
            document.getElementById('phishshield-popup').onclick = () => {
                chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
                overlay.remove();
            };

            // Auto-remove after 30 seconds
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    overlay.remove();
                }
            }, 30000);
        }

        showNotification(message, type = 'info') {
            // Use Chrome notifications if available
            if (chrome && chrome.notifications) {
                chrome.runtime.sendMessage({
                    type: 'SHOW_NOTIFICATION',
                    message: message,
                    notificationType: type
                });
            } else {
                // Fallback to alert
                alert(message);
            }
        }

        sendMessage(message) {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage(message, (response) => {
                    resolve(response || { success: false, error: 'No response' });
                });
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new GmailExtractor());
    } else {
        new GmailExtractor();
    }

})();