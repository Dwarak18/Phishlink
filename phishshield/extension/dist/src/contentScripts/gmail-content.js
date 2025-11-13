(function(){console.log("PhishShield Gmail content script loaded");class r{constructor(){this.isGmail=window.location.hostname==="mail.google.com",this.currentEmailData=null,this.observer=null,this.scanButton=null,this.isGmail&&this.initialize()}initialize(){this.waitForGmail().then(()=>{this.setupEmailDetection(),this.injectScanButton(),console.log("PhishShield Gmail integration ready")}),window.phishShieldExtractor=this}async waitForGmail(){return new Promise(e=>{const t=()=>{document.querySelector('[role="main"]')||document.querySelector(".nH")?e():setTimeout(t,100)};t()})}setupEmailDetection(){this.observer=new MutationObserver(e=>{e.forEach(t=>{t.type==="childList"&&this.isEmailView()&&this.handleEmailView()})}),this.observer.observe(document.body,{childList:!0,subtree:!0}),this.isEmailView()&&this.handleEmailView()}isEmailView(){return!!(document.querySelector("[data-message-id]")||document.querySelector(".ii.gt")||document.querySelector('[role="listitem"] [email]'))}handleEmailView(){setTimeout(()=>{this.updateScanButton()},500)}getCurrentEmail(){if(!this.isEmailView())throw new Error("Not viewing an email");const e=this.extractEmailData();return this.currentEmailData=e,e}extractEmailData(){let e={subject:"",from:"",to:[],body:"",links:[],headers:null,attachments:[],message_id:null};try{const t=document.querySelector("[data-thread-perm-id] h2")||document.querySelector(".hP")||document.querySelector("[data-legacy-thread-id] span[title]");t&&(e.subject=t.textContent||t.title||"");const o=document.querySelector("[email]")||document.querySelector(".go span[email]")||document.querySelector(".gD")||document.querySelector(".qu .go span");o&&(e.from=o.getAttribute("email")||o.textContent||o.title||"");const n=document.querySelectorAll(".g2 [email]")||document.querySelectorAll(".hb [email]");e.to=Array.from(n).map(i=>i.getAttribute("email")||i.textContent||"").filter(i=>i);const s=document.querySelectorAll(".ii.gt div")||document.querySelectorAll("[data-message-id] .ii.gt")||document.querySelectorAll(".adn.ads .ii.gt");let l="";s.forEach(i=>{const a=i.textContent||"";a.trim()&&!a.includes("Gmail")&&(l+=a+`
`)}),e.body=l.trim();const d=document.querySelectorAll(".ii.gt a[href]");e.links=Array.from(d).map(i=>i.href).filter(i=>i&&!i.startsWith("mailto:")).slice(0,20);const m=document.querySelectorAll(".aZo span[title]")||document.querySelectorAll(".aS2 span[title]");e.attachments=Array.from(m).map(i=>i.title||i.textContent||"").filter(i=>i);const c=document.querySelector("[data-message-id]");return c&&(e.message_id=c.getAttribute("data-message-id")),e.message_id||(e.message_id=`gmail_${Date.now()}_${Math.random().toString(36).substr(2,9)}`),console.log("Extracted Gmail data:",e),e}catch(t){throw console.error("Error extracting Gmail data:",t),new Error("Failed to extract email data")}}injectScanButton(){const e=[()=>document.querySelector(".ar9.T-I-J3"),()=>document.querySelector(".T-I.T-I-atl"),()=>document.querySelector(".aio"),()=>document.querySelector(".nH .ar")];for(const t of e){const o=t();if(o){this.createScanButton(o);break}}}createScanButton(e){const t=document.querySelector("#phishshield-scan-button");t&&t.remove(),this.scanButton=document.createElement("button"),this.scanButton.id="phishshield-scan-button",this.scanButton.innerHTML="🛡️ Scan Email",this.scanButton.className="phishshield-scan-btn",this.scanButton.title="Scan this email for phishing threats",this.scanButton.addEventListener("click",o=>{o.preventDefault(),this.scanCurrentEmail()}),e.tagName==="DIV"?e.appendChild(this.scanButton):e.parentElement.insertBefore(this.scanButton,e.nextSibling)}updateScanButton(){(!this.scanButton||!document.body.contains(this.scanButton))&&this.injectScanButton(),this.scanButton&&(this.scanButton.disabled=!this.isEmailView(),this.scanButton.style.opacity=this.isEmailView()?"1":"0.5")}async scanCurrentEmail(){if(!this.isEmailView()){this.showNotification("Please select an email to scan","warning");return}try{this.scanButton.disabled=!0,this.scanButton.innerHTML="🔄 Scanning...";const e=this.getCurrentEmail(),t=await this.sendMessage({type:"ANALYZE_EMAIL",emailData:e});if(t.success)this.showAnalysisResult(t.data);else throw new Error(t.error||"Analysis failed")}catch(e){console.error("Scan error:",e),this.showNotification("Scan failed: "+e.message,"error")}finally{this.scanButton.disabled=!1,this.scanButton.innerHTML="🛡️ Scan Email"}}showAnalysisResult(e){const t=`
                PhishShield Analysis Complete!
                
                Risk Level: ${e.risk_level.toUpperCase()}
                Risk Score: ${Math.round(e.risk_score)}/100
                Issues Found: ${e.flags.length}
                
                ${e.recommendations.slice(0,2).join(`
`)}
            `;this.showNotification(t,e.risk_level),this.showDetailedResults(e)}showDetailedResults(e){const t=document.querySelector("#phishshield-overlay");t&&t.remove();const o={safe:"#4CAF50",low:"#FF9800",medium:"#FF5722",high:"#F44336",critical:"#B71C1C"},n=document.createElement("div");n.id="phishshield-overlay",n.style.cssText=`
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                max-height: 500px;
                background: white;
                border: 3px solid ${o[e.risk_level]};
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
                font-family: Arial, sans-serif;
            `,n.innerHTML=`
                <div style="padding: 15px; border-bottom: 1px solid #eee; background: ${o[e.risk_level]}; color: white;">
                    <h3 style="margin: 0; font-size: 16px;">🛡️ PhishShield Analysis</h3>
                    <button id="phishshield-close" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <h2 style="color: ${o[e.risk_level]}; margin: 5px 0;">
                            ${e.risk_level.toUpperCase()} RISK
                        </h2>
                        <div style="font-size: 18px; font-weight: bold;">
                            Score: ${Math.round(e.risk_score)}/100
                        </div>
                    </div>
                    
                    ${e.flags.length>0?`
                        <div style="margin: 10px 0;">
                            <strong>Issues Found (${e.flags.length}):</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${e.flags.slice(0,5).map(s=>`<li><strong>${s.severity.toUpperCase()}:</strong> ${s.description}</li>`).join("")}
                            </ul>
                        </div>
                    `:""}
                    
                    ${e.recommendations.length>0?`
                        <div style="margin: 10px 0;">
                            <strong>Recommendations:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                ${e.recommendations.slice(0,3).map(s=>`<li>${s}</li>`).join("")}
                            </ul>
                        </div>
                    `:""}
                    
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
            `,document.body.appendChild(n),document.getElementById("phishshield-close").onclick=()=>n.remove(),document.getElementById("phishshield-dismiss").onclick=()=>n.remove(),document.getElementById("phishshield-popup").onclick=()=>{chrome.runtime.sendMessage({type:"OPEN_POPUP"}),n.remove()},setTimeout(()=>{document.body.contains(n)&&n.remove()},3e4)}showNotification(e,t="info"){chrome&&chrome.notifications?chrome.runtime.sendMessage({type:"SHOW_NOTIFICATION",message:e,notificationType:t}):alert(e)}sendMessage(e){return new Promise(t=>{chrome.runtime.sendMessage(e,o=>{t(o||{success:!1,error:"No response"})})})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new r):new r})();
