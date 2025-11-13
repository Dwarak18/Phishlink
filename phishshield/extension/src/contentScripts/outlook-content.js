/**
 * Outlook Content Script for PhishShield
 * Extracts email data from Outlook web interface and provides scanning capabilities
 */

(function() {
    'use strict';

    console.log('PhishShield Outlook content script loaded');

    class OutlookExtractor {
        constructor() {
            this.isOutlook = this.detectOutlook();
            this.currentEmailData = null;
            this.observer = null;
            this.scanButton = null;
            
            if (this.isOutlook) {
                this.initialize();
            }
        }

        detectOutlook() {
            const hostname = window.location.hostname;
            return hostname.includes('outlook.live.com') ||
                   hostname.includes('outlook.office.com') ||
                   hostname.includes('outlook.office365.com');
        }

        initialize() {
            // Wait for Outlook to load
            this.waitForOutlook().then(() => {
                this.setupEmailDetection();
                this.injectScanButton();
                console.log('PhishShield Outlook integration ready');
            });

            // Make extractor available globally for background script
            window.phishShieldExtractor = this;
        }

        async waitForOutlook() {
            return new Promise((resolve) => {
                const checkOutlook = () => {
                    if (document.querySelector('[role="main"]') || 
                        document.querySelector('.wide-content-host') ||
                        document.querySelector('div[data-app-section="MailModule"]')) {
                        setTimeout(resolve, 1000); // Extra delay for Outlook
                    } else {
                        setTimeout(checkOutlook, 200);
                    }
                };
                checkOutlook();
            });
        }

        setupEmailDetection() {
            // Watch for navigation changes in Outlook
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
            // Multiple selectors for different Outlook versions
            return !!(
                document.querySelector('[data-app-section="MailModule"] [role="main"] [aria-label*="message"]') ||
                document.querySelector('div[data-convid]') ||
                document.querySelector('[data-testid="message-body"]') ||
                document.querySelector('.allowTextSelection') ||
                document.querySelector('div[aria-label*="Message body"]') ||
                document.querySelector('.rps_d4bb')
            );
        }

        handleEmailView() {
            setTimeout(() => {
                this.updateScanButton();
            }, 1000); // Give Outlook more time to load content
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
                // Extract subject - multiple selectors for different Outlook versions
                const subjectSelectors = [
                    '[data-testid="message-subject"]',
                    '.rps_83cd',
                    'h1[id*="ConversationReadingPaneSubject"]',
                    '[aria-label*="Subject"]',
                    '.allowTextSelection h1',
                    'span[title][aria-level="1"]'
                ];

                for (const selector of subjectSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        emailData.subject = element.textContent.trim();
                        break;
                    }
                }

                // Extract sender
                const senderSelectors = [
                    '[data-testid="message-header-from-name"]',
                    '[data-testid="message-header-from-email"]',
                    '.rps_9d8f',
                    'button[aria-label*="From:"]',
                    '[title*="@"]',
                    'span[dir="ltr"][title*="@"]'
                ];

                for (const selector of senderSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.title || element.getAttribute('aria-label') || '';
                        if (text.includes('@')) {
                            emailData.from = text.trim();
                            break;
                        }
                    }
                }

                // Try to extract from button aria-labels
                const fromButtons = document.querySelectorAll('button[aria-label*="From:"]');
                fromButtons.forEach(btn => {
                    const label = btn.getAttribute('aria-label');
                    if (label && label.includes('@')) {
                        emailData.from = label.replace('From:', '').trim();
                    }
                });

                // Extract recipients (To field)
                const toSelectors = [
                    '[data-testid="message-header-to-list"]',
                    '[aria-label*="To:"]',
                    '.rps_cfb4'
                ];

                for (const selector of toSelectors) {
                    const elements = document.querySelectorAll(`${selector} [title*="@"]`);
                    if (elements.length > 0) {
                        emailData.to = Array.from(elements).map(el => 
                            el.title || el.textContent || ''
                        ).filter(email => email.includes('@'));
                        break;
                    }
                }

                // Extract message body - multiple approaches
                const bodySelectors = [
                    '[data-testid="message-body"]',
                    '[data-testid="message-body-content"]',
                    '.rps_d4bb',
                    '.allowTextSelection div[dir="ltr"]',
                    '[aria-label*="Message body"]',
                    'div[contenteditable="false"] div'
                ];

                let bodyText = '';
                for (const selector of bodySelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        // Try to get the actual message content
                        const text = element.textContent || element.innerText || '';
                        if (text.trim() && text.length > 10) {
                            bodyText = text.trim();
                            break;
                        }
                    }
                }

                // If no body found, try a broader search
                if (!bodyText) {
                    const contentDivs = document.querySelectorAll('div[dir="ltr"]');
                    contentDivs.forEach(div => {
                        const text = div.textContent || '';
                        if (text.length > bodyText.length && text.length > 20) {
                            // Check if it looks like email content (not UI elements)
                            if (!text.includes('Outlook') && !text.includes('Microsoft') && 
                                !text.includes('Reply') && !text.includes('Forward')) {
                                bodyText = text;
                            }
                        }
                    });
                }

                emailData.body = bodyText;

                // Extract links
                const linkElements = document.querySelectorAll('a[href]');
                emailData.links = Array.from(linkElements)
                    .map(link => link.href)
                    .filter(href => href && 
                            !href.startsWith('mailto:') && 
                            !href.includes('outlook.') &&
                            !href.includes('microsoft.') &&
                            href.startsWith('http'))
                    .slice(0, 20); // Limit to first 20 links

                // Extract attachment info
                const attachmentSelectors = [
                    '[data-testid="attachment-item"]',
                    '[aria-label*="attachment"]',
                    '.rps_attachments',
                    'button[aria-label*="Download"]'
                ];

                let attachments = [];
                for (const selector of attachmentSelectors) {
                    const elements = document.querySelectorAll(selector);
                    attachments = Array.from(elements).map(el => {
                        return el.textContent || 
                               el.getAttribute('aria-label') || 
                               el.title || '';
                    }).filter(name => name.trim());
                    
                    if (attachments.length > 0) break;
                }

                emailData.attachments = attachments;

                // Try to get message ID from data attributes
                const messageElements = document.querySelectorAll('[data-convid], [data-item-id], [id*="message"]');
                for (const el of messageElements) {
                    const id = el.getAttribute('data-convid') || 
                              el.getAttribute('data-item-id') || 
                              el.id;
                    if (id && id.length > 5) {
                        emailData.message_id = id;
                        break;
                    }
                }

                // Generate fallback message ID
                if (!emailData.message_id) {
                    emailData.message_id = `outlook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }

                console.log('Extracted Outlook data:', emailData);
                return emailData;

            } catch (error) {
                console.error('Error extracting Outlook data:', error);
                throw new Error('Failed to extract email data from Outlook');
            }
        }

        injectScanButton() {
            // Try multiple locations for the scan button in Outlook
            const insertLocations = [
                () => document.querySelector('[data-testid="toolbar"]'),
                () => document.querySelector('.ms-CommandBar'),
                () => document.querySelector('[role="toolbar"]'),
                () => document.querySelector('.commandBarWrapper'),
                () => document.querySelector('div[data-app-section="MailModule"] [role="banner"]')
            ];

            for (const getLocation of insertLocations) {
                const location = getLocation();
                if (location) {
                    this.createScanButton(location);
                    break;
                }
            }

            // If no location found, create floating button
            if (!this.scanButton) {
                this.createFloatingScanButton();
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
            this.scanButton.innerHTML = '🛡️ PhishShield Scan';
            this.scanButton.className = 'phishshield-scan-btn ms-Button';
            this.scanButton.title = 'Scan this email for phishing threats';
            
            this.scanButton.style.cssText = `
                background: #0078d4;
                color: white;
                border: none;
                padding: 8px 12px;
                margin: 0 5px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
                font-family: "Segoe UI", sans-serif;
            `;
            
            this.scanButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.scanCurrentEmail();
            });

            parentElement.appendChild(this.scanButton);
        }

        createFloatingScanButton() {
            // Create floating scan button as fallback
            this.scanButton = document.createElement('button');
            this.scanButton.id = 'phishshield-scan-button';
            this.scanButton.innerHTML = '🛡️';
            this.scanButton.title = 'PhishShield: Scan for phishing threats';
            
            this.scanButton.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: #0078d4;
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 10000;
                transition: all 0.3s ease;
            `;

            this.scanButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.scanCurrentEmail();
            });

            this.scanButton.addEventListener('mouseenter', () => {
                this.scanButton.style.transform = 'scale(1.1)';
                this.scanButton.innerHTML = '🛡️ Scan';
                this.scanButton.style.width = 'auto';
                this.scanButton.style.padding = '15px 20px';
                this.scanButton.style.borderRadius = '25px';
                this.scanButton.style.fontSize = '14px';
            });

            this.scanButton.addEventListener('mouseleave', () => {
                this.scanButton.style.transform = 'scale(1)';
                this.scanButton.innerHTML = '🛡️';
                this.scanButton.style.width = '50px';
                this.scanButton.style.padding = '0';
                this.scanButton.style.borderRadius = '50%';
                this.scanButton.style.fontSize = '20px';
            });

            document.body.appendChild(this.scanButton);
        }

        updateScanButton() {
            if (!this.scanButton || !document.body.contains(this.scanButton)) {
                this.injectScanButton();
            }

            if (this.scanButton) {
                const isEmailVisible = this.isEmailView();
                this.scanButton.disabled = !isEmailVisible;
                this.scanButton.style.opacity = isEmailVisible ? '1' : '0.5';
                
                if (!isEmailVisible) {
                    this.scanButton.title = 'PhishShield: Please select an email to scan';
                } else {
                    this.scanButton.title = 'PhishShield: Scan this email for phishing threats';
                }
            }
        }

        async scanCurrentEmail() {
            if (!this.isEmailView()) {
                this.showNotification('Please select an email to scan', 'warning');
                return;
            }

            try {
                this.scanButton.disabled = true;
                const originalText = this.scanButton.innerHTML;
                this.scanButton.innerHTML = this.scanButton.style.width === '50px' ? '🔄' : '🔄 Scanning...';

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
                this.scanButton.innerHTML = this.scanButton.style.width === '50px' ? '🛡️' : '🛡️ PhishShield Scan';
            }
        }

        showAnalysisResult(result) {
            const message = `
                PhishShield Analysis Complete!
                
                Risk Level: ${result.risk_level.toUpperCase()}
                Risk Score: ${Math.round(result.risk_score)}/100
                Issues Found: ${result.flags.length}
                
                ${result.recommendations.slice(0, 2).join('\n')}
            `;

            this.showNotification(message, result.risk_level);
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

            // Create overlay (same as Gmail implementation)
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
                font-family: "Segoe UI", sans-serif;
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
                            background: #0078d4; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 2px; 
                            cursor: pointer;
                            margin-right: 10px;
                            font-family: 'Segoe UI', sans-serif;
                        ">View Details</button>
                        <button id="phishshield-dismiss" style="
                            background: #666; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 2px; 
                            cursor: pointer;
                            font-family: 'Segoe UI', sans-serif;
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
        document.addEventListener('DOMContentLoaded', () => new OutlookExtractor());
    } else {
        new OutlookExtractor();
    }

})();