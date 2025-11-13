(function(){console.log("PhishShield Outlook content script loaded");class d{constructor(){this.isOutlook=this.detectOutlook(),this.currentEmailData=null,this.observer=null,this.scanButton=null,this.isOutlook&&this.initialize()}detectOutlook(){const t=window.location.hostname;return t.includes("outlook.live.com")||t.includes("outlook.office.com")||t.includes("outlook.office365.com")}initialize(){this.waitForOutlook().then(()=>{this.setupEmailDetection(),this.injectScanButton(),console.log("PhishShield Outlook integration ready")}),window.phishShieldExtractor=this}async waitForOutlook(){return new Promise(t=>{const o=()=>{document.querySelector('[role="main"]')||document.querySelector(".wide-content-host")||document.querySelector('div[data-app-section="MailModule"]')?setTimeout(t,1e3):setTimeout(o,200)};o()})}setupEmailDetection(){this.observer=new MutationObserver(t=>{t.forEach(o=>{o.type==="childList"&&this.isEmailView()&&this.handleEmailView()})}),this.observer.observe(document.body,{childList:!0,subtree:!0}),this.isEmailView()&&this.handleEmailView()}isEmailView(){return!!(document.querySelector('[data-app-section="MailModule"] [role="main"] [aria-label*="message"]')||document.querySelector("div[data-convid]")||document.querySelector('[data-testid="message-body"]')||document.querySelector(".allowTextSelection")||document.querySelector('div[aria-label*="Message body"]')||document.querySelector(".rps_d4bb"))}handleEmailView(){setTimeout(()=>{this.updateScanButton()},1e3)}getCurrentEmail(){if(!this.isEmailView())throw new Error("Not viewing an email");const t=this.extractEmailData();return this.currentEmailData=t,t}extractEmailData(){let t={subject:"",from:"",to:[],body:"",links:[],headers:null,attachments:[],message_id:null};try{const o=['[data-testid="message-subject"]',".rps_83cd",'h1[id*="ConversationReadingPaneSubject"]','[aria-label*="Subject"]',".allowTextSelection h1",'span[title][aria-level="1"]'];for(const s of o){const e=document.querySelector(s);if(e&&e.textContent.trim()){t.subject=e.textContent.trim();break}}const n=['[data-testid="message-header-from-name"]','[data-testid="message-header-from-email"]',".rps_9d8f",'button[aria-label*="From:"]','[title*="@"]','span[dir="ltr"][title*="@"]'];for(const s of n){const e=document.querySelector(s);if(e){const i=e.textContent||e.title||e.getAttribute("aria-label")||"";if(i.includes("@")){t.from=i.trim();break}}}document.querySelectorAll('button[aria-label*="From:"]').forEach(s=>{const e=s.getAttribute("aria-label");e&&e.includes("@")&&(t.from=e.replace("From:","").trim())});const r=['[data-testid="message-header-to-list"]','[aria-label*="To:"]',".rps_cfb4"];for(const s of r){const e=document.querySelectorAll(`${s} [title*="@"]`);if(e.length>0){t.to=Array.from(e).map(i=>i.title||i.textContent||"").filter(i=>i.includes("@"));break}}const u=['[data-testid="message-body"]','[data-testid="message-body-content"]',".rps_d4bb",'.allowTextSelection div[dir="ltr"]','[aria-label*="Message body"]','div[contenteditable="false"] div'];let l="";for(const s of u){const e=document.querySelector(s);if(e){const i=e.textContent||e.innerText||"";if(i.trim()&&i.length>10){l=i.trim();break}}}l||document.querySelectorAll('div[dir="ltr"]').forEach(e=>{const i=e.textContent||"";i.length>l.length&&i.length>20&&!i.includes("Outlook")&&!i.includes("Microsoft")&&!i.includes("Reply")&&!i.includes("Forward")&&(l=i)}),t.body=l;const h=document.querySelectorAll("a[href]");t.links=Array.from(h).map(s=>s.href).filter(s=>s&&!s.startsWith("mailto:")&&!s.includes("outlook.")&&!s.includes("microsoft.")&&s.startsWith("http")).slice(0,20);const m=['[data-testid="attachment-item"]','[aria-label*="attachment"]',".rps_attachments",'button[aria-label*="Download"]'];let c=[];for(const s of m){const e=document.querySelectorAll(s);if(c=Array.from(e).map(i=>i.textContent||i.getAttribute("aria-label")||i.title||"").filter(i=>i.trim()),c.length>0)break}t.attachments=c;const p=document.querySelectorAll('[data-convid], [data-item-id], [id*="message"]');for(const s of p){const e=s.getAttribute("data-convid")||s.getAttribute("data-item-id")||s.id;if(e&&e.length>5){t.message_id=e;break}}return t.message_id||(t.message_id=`outlook_${Date.now()}_${Math.random().toString(36).substr(2,9)}`),console.log("Extracted Outlook data:",t),t}catch(o){throw console.error("Error extracting Outlook data:",o),new Error("Failed to extract email data from Outlook")}}injectScanButton(){const t=[()=>document.querySelector('[data-testid="toolbar"]'),()=>document.querySelector(".ms-CommandBar"),()=>document.querySelector('[role="toolbar"]'),()=>document.querySelector(".commandBarWrapper"),()=>document.querySelector('div[data-app-section="MailModule"] [role="banner"]')];for(const o of t){const n=o();if(n){this.createScanButton(n);break}}this.scanButton||this.createFloatingScanButton()}createScanButton(t){const o=document.querySelector("#phishshield-scan-button");o&&o.remove(),this.scanButton=document.createElement("button"),this.scanButton.id="phishshield-scan-button",this.scanButton.innerHTML="🛡️ PhishShield Scan",this.scanButton.className="phishshield-scan-btn ms-Button",this.scanButton.title="Scan this email for phishing threats",this.scanButton.style.cssText=`
                background: #0078d4;
                color: white;
                border: none;
                padding: 8px 12px;
                margin: 0 5px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
                font-family: "Segoe UI", sans-serif;
            `,this.scanButton.addEventListener("click",n=>{n.preventDefault(),this.scanCurrentEmail()}),t.appendChild(this.scanButton)}createFloatingScanButton(){this.scanButton=document.createElement("button"),this.scanButton.id="phishshield-scan-button",this.scanButton.innerHTML="🛡️",this.scanButton.title="PhishShield: Scan for phishing threats",this.scanButton.style.cssText=`
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
            `,this.scanButton.addEventListener("click",t=>{t.preventDefault(),this.scanCurrentEmail()}),this.scanButton.addEventListener("mouseenter",()=>{this.scanButton.style.transform="scale(1.1)",this.scanButton.innerHTML="🛡️ Scan",this.scanButton.style.width="auto",this.scanButton.style.padding="15px 20px",this.scanButton.style.borderRadius="25px",this.scanButton.style.fontSize="14px"}),this.scanButton.addEventListener("mouseleave",()=>{this.scanButton.style.transform="scale(1)",this.scanButton.innerHTML="🛡️",this.scanButton.style.width="50px",this.scanButton.style.padding="0",this.scanButton.style.borderRadius="50%",this.scanButton.style.fontSize="20px"}),document.body.appendChild(this.scanButton)}updateScanButton(){if((!this.scanButton||!document.body.contains(this.scanButton))&&this.injectScanButton(),this.scanButton){const t=this.isEmailView();this.scanButton.disabled=!t,this.scanButton.style.opacity=t?"1":"0.5",t?this.scanButton.title="PhishShield: Scan this email for phishing threats":this.scanButton.title="PhishShield: Please select an email to scan"}}async scanCurrentEmail(){if(!this.isEmailView()){this.showNotification("Please select an email to scan","warning");return}try{this.scanButton.disabled=!0;const t=this.scanButton.innerHTML;this.scanButton.innerHTML=this.scanButton.style.width==="50px"?"🔄":"🔄 Scanning...";const o=this.getCurrentEmail(),n=await this.sendMessage({type:"ANALYZE_EMAIL",emailData:o});if(n.success)this.showAnalysisResult(n.data);else throw new Error(n.error||"Analysis failed")}catch(t){console.error("Scan error:",t),this.showNotification("Scan failed: "+t.message,"error")}finally{this.scanButton.disabled=!1,this.scanButton.innerHTML=this.scanButton.style.width==="50px"?"🛡️":"🛡️ PhishShield Scan"}}showAnalysisResult(t){const o=`
                PhishShield Analysis Complete!
                
                Risk Level: ${t.risk_level.toUpperCase()}
                Risk Score: ${Math.round(t.risk_score)}/100
                Issues Found: ${t.flags.length}
                
                ${t.recommendations.slice(0,2).join(`
`)}
            `;this.showNotification(o,t.risk_level),this.showDetailedResults(t)}showDetailedResults(t){const o=document.querySelector("#phishshield-overlay");o&&o.remove();const n={safe:"#4CAF50",low:"#FF9800",medium:"#FF5722",high:"#F44336",critical:"#B71C1C"},a=document.createElement("div");a.id="phishshield-overlay",a.style.cssText=`
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                max-height: 500px;
                background: white;
                border: 3px solid ${n[t.risk_level]};
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
                font-family: "Segoe UI", sans-serif;
            `,a.innerHTML=`
                <div style="padding: 15px; border-bottom: 1px solid #eee; background: ${n[t.risk_level]}; color: white;">
                    <h3 style="margin: 0; font-size: 16px;">🛡️ PhishShield Analysis</h3>
                    <button id="phishshield-close" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <h2 style="color: ${n[t.risk_level]}; margin: 5px 0;">
                            ${t.risk_level.toUpperCase()} RISK
                        </h2>
                        <div style="font-size: 18px; font-weight: bold;">
                            Score: ${Math.round(t.risk_score)}/100
                        </div>
                    </div>
                    
                    ${t.flags.length>0?`
                        <div style="margin: 10px 0;">
                            <strong>Issues Found (${t.flags.length}):</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${t.flags.slice(0,5).map(r=>`<li><strong>${r.severity.toUpperCase()}:</strong> ${r.description}</li>`).join("")}
                            </ul>
                        </div>
                    `:""}
                    
                    ${t.recommendations.length>0?`
                        <div style="margin: 10px 0;">
                            <strong>Recommendations:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${t.recommendations.slice(0,3).map(r=>`<li>${r}</li>`).join("")}
                            </ul>
                        </div>
                    `:""}
                    
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
            `,document.body.appendChild(a),document.getElementById("phishshield-close").onclick=()=>a.remove(),document.getElementById("phishshield-dismiss").onclick=()=>a.remove(),document.getElementById("phishshield-popup").onclick=()=>{chrome.runtime.sendMessage({type:"OPEN_POPUP"}),a.remove()},setTimeout(()=>{document.body.contains(a)&&a.remove()},3e4)}showNotification(t,o="info"){chrome&&chrome.notifications?chrome.runtime.sendMessage({type:"SHOW_NOTIFICATION",message:t,notificationType:o}):alert(t)}sendMessage(t){return new Promise(o=>{chrome.runtime.sendMessage(t,n=>{o(n||{success:!1,error:"No response"})})})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new d):new d})();
