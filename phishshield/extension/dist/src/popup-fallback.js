class a{constructor(){this.initializePopup()}async initializePopup(){try{const[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!this.isEmailPage(e.url)){this.showError("Please open Gmail or Outlook to scan emails");return}this.showLoading();const s=await this.sendMessage({type:"GET_CURRENT_EMAIL"});if(!s.success){this.showError(s.error||"Could not extract email data");return}const i=await this.sendMessage({type:"ANALYZE_EMAIL",emailData:s.data});i.success?this.showResults(s.data,i.data):this.showError(i.error||"Analysis failed")}catch(e){console.error("Popup error:",e),this.showError("Failed to initialize PhishShield")}}sendMessage(e){return new Promise(s=>{chrome.runtime.sendMessage(e,i=>{s(i||{success:!1,error:"No response"})})})}isEmailPage(e){return e&&(e.includes("mail.google.com")||e.includes("outlook.live.com")||e.includes("outlook.office.com")||e.includes("outlook.office365.com"))}showLoading(){document.getElementById("root").innerHTML=`
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
        `}showError(e){document.getElementById("root").innerHTML=`
            <div class="popup-container">
                <div class="header">
                    <img src="../icons/icon32.png" alt="PhishShield" class="logo" />
                    <h1>PhishShield</h1>
                </div>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h3>Unable to Scan</h3>
                    <p>${e}</p>
                    <button onclick="location.reload()" class="retry-button">
                        Try Again
                    </button>
                </div>
            </div>
        `}showResults(e,s){const i=this.getRiskConfig(s.risk_level);document.getElementById("root").innerHTML=`
            <div class="popup-container">
                <div class="header">
                    <img src="../icons/icon32.png" alt="PhishShield" class="logo" />
                    <h1>PhishShield</h1>
                </div>
                
                <div class="analysis-results">
                    <div class="risk-summary" style="border-color: ${i.color}">
                        <div class="risk-icon" style="color: ${i.color}">
                            ${i.icon}
                        </div>
                        <div class="risk-info">
                            <h2 style="color: ${i.color}">
                                ${i.label}
                            </h2>
                            <div class="risk-score">
                                Risk Score: ${Math.round(s.risk_score)}/100
                            </div>
                        </div>
                    </div>

                    <div class="email-info">
                        <div class="email-field">
                            <strong>From:</strong> 
                            <span class="email-value">${e.from_address||"Unknown"}</span>
                        </div>
                        <div class="email-field">
                            <strong>Subject:</strong> 
                            <span class="email-value">${e.subject||"No subject"}</span>
                        </div>
                    </div>

                    ${this.renderFlags(s.flags)}
                    ${this.renderRecommendations(s.recommendations)}

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
        `,this.currentEmailData=e}getRiskConfig(e){const s={safe:{color:"#4CAF50",icon:"✅",label:"Safe"},low:{color:"#FF9800",icon:"⚠️",label:"Low Risk"},medium:{color:"#FF5722",icon:"🚨",label:"Medium Risk"},high:{color:"#F44336",icon:"🔴",label:"High Risk"},critical:{color:"#B71C1C",icon:"💀",label:"Critical Risk"}};return s[e]||s.safe}renderFlags(e){return!e||e.length===0?"":`
            <div class="flags-summary">
                <h3>Security Issues Found (${e.length})</h3>
                <div class="flags-list">
                    ${e.slice(0,3).map(s=>`
                        <div class="flag-item severity-${s.severity}">
                            <span class="flag-type">${s.severity.toUpperCase()}</span>
                            <span class="flag-description">${s.description}</span>
                        </div>
                    `).join("")}
                    ${e.length>3?`
                        <div class="more-flags">
                            +${e.length-3} more issues
                        </div>
                    `:""}
                </div>
            </div>
        `}renderRecommendations(e){return!e||e.length===0?"":`
            <div class="recommendations">
                <h3>Security Recommendations</h3>
                <ul>
                    ${e.slice(0,3).map(s=>`<li>${s}</li>`).join("")}
                </ul>
            </div>
        `}async submitFeedback(e,s){try{if(!this.currentEmailData?.message_id){alert("Cannot submit feedback: No message ID available");return}const i={message_id:this.currentEmailData.message_id,is_phishing:e,feedback_type:s,comments:null};(await this.sendMessage({type:"SUBMIT_FEEDBACK",feedback:i})).success?alert("Thank you for your feedback!"):alert("Failed to submit feedback")}catch(i){console.error("Feedback error:",i),alert("Error submitting feedback")}}}let o;try{if(typeof React<"u")console.log("Loading React popup");else throw new Error("React not available")}catch{console.log("Loading vanilla JS popup"),document.addEventListener("DOMContentLoaded",()=>{o=new a})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{o||(o=new a)}):o||(o=new a);
