// --- 1. CONFIGURATION & MOCK DATA ---

const EXISTING_TITLES = [
    "The Times of India", "Hindustan Times", "Dainik Bhaskar", 
    "Rajasthan Patrika", "The Hindu", "Amar Ujala", 
    "Malayala Manorama", "Eenadu", "Sakshi", "Daily Thanthi",
    "Indian Express", "Economic Times", "Financial Express"
];

const BANNED_KEYWORDS = [
    "police", "army", "government", "cbi", "court", "judge", 
    "corruption", "bribe", "scam", "anti-national", "terror", "president", "pm"
];

// --- 2. FIREBASE INIT ---
const firebaseConfig = JSON.parse(new URLSearchParams(window.location.search).get('__firebase_config') || '{}');
let appInstance, auth, db;
const appId = 'patra-app';

try {
    if (Object.keys(firebaseConfig).length > 0 && typeof firebase !== 'undefined') {
        appInstance = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
    } else {
        console.warn("Firebase not initialized: Config missing or library not loaded.");
    }
} catch (e) { console.error("Firebase init failed:", e); }

// --- 3. CORE LOGIC (AI ENGINE) ---

const Logic = {
    levenshtein: (a, b) => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    },

    getPhoneticCode: (str) => {
        let s = str.toLowerCase().replace(/[^a-z]/g, '');
        s = s.replace(/[aeiouwh]/g, ''); 
        s = s.replace(/[bfpv]/g, '1').replace(/[cgjkqsxz]/g, '2')
             .replace(/[dt]/g, '3').replace(/l/g, '4')
             .replace(/[mn]/g, '5').replace(/r/g, '6');
        return s.substring(0, 4);
    },

    analyze: (input) => {
        const lowerInput = input.toLowerCase().trim();
        let result = { score: 0, risk: "Low", flags: [], matches: [] };

        if (!input) return result;

        // 1. Keyword Check
        const foundBanned = BANNED_KEYWORDS.filter(k => lowerInput.includes(k));
        if (foundBanned.length > 0) {
            result.score += 50;
            result.flags.push(`Contains restricted term(s): ${foundBanned.join(', ')}`);
        }

        // 2. Similarity Check
        let maxSim = 0;
        let closestTitle = "";
        
        EXISTING_TITLES.forEach(existing => {
            const lev = Logic.levenshtein(lowerInput, existing.toLowerCase());
            const len = Math.max(lowerInput.length, existing.length);
            const similarity = (1 - (lev / len)) * 100;
            
            if (similarity > maxSim) {
                maxSim = similarity;
                closestTitle = existing;
            }
        });

        if (maxSim > 60) {
            result.score += maxSim * 0.8;
            result.matches.push(`Similar to: "${closestTitle}" (${Math.round(maxSim)}%)`);
        } else if (maxSim > 40) {
            result.score += 20;
            result.matches.push(`Resembles: "${closestTitle}"`);
        }

        // 3. Length Checks
        if (lowerInput.length < 3) {
            result.score += 30;
            result.flags.push("Title is too short.");
        }

        // Finalize
        result.score = Math.min(100, Math.round(result.score));
        if (result.score < 30) result.risk = "Low";
        else if (result.score < 70) result.risk = "Medium";
        else result.risk = "High";

        return result;
    },

    generateAlternatives: (input) => {
        const suffixes = ["Chronicle", "Voice", "Herald", "Monitor", "Journal"];
        const prefixes = ["The New", "Local", "Morning", "City", "Metro"];
        const base = input.replace(/\b(Daily|The|Times|News)\b/gi, '').trim() || "Paper";
        
        const alts = [];
        alts.push(`${base} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`);
        alts.push(`${prefixes[Math.floor(Math.random() * prefixes.length)]} ${base}`);
        alts.push(`The ${base} Insight`);
        return alts;
    }
};

// --- 4. APP CONTROLLER ---

const app = {
    currentUser: null,
    currentRefId: null,
    historyUnsubscribe: null,

    init: async () => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        if (auth) {
            auth.onAuthStateChanged(user => {
                app.currentUser = user;
                if (user) {
                    if (user.email === 'officer@rni.gov.in') {
                        app.listenToOfficerData();
                    } else {
                        app.loadUserHistory(); // Load public user history
                    }
                } else {
                    firebase.auth().signInAnonymously().catch(console.error);
                }
            });
        } else {
            // Fallback for no-auth environments (render local history if any)
            app.loadUserHistory();
        }
    },

    navigate: (viewId) => {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewId}`).classList.remove('hidden');
        
        if (viewId === 'officer' && !app.officerAuthenticated) {
            document.getElementById('officer-dashboard').classList.add('hidden');
            document.getElementById('officer-login').classList.remove('hidden');
        }
        if (viewId === 'history') app.loadUserHistory();
        window.scrollTo(0,0);
    },

    verifyTitle: async () => {
        const input = document.getElementById('citizen-input').value;
        if (!input) return alert("Please enter a title.");

        const btn = document.querySelector('button[onclick="app.verifyTitle()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader" class="animate-spin w-5 h-5"></i>`;
        btn.disabled = true;

        // Simulate AI Timeline effect
        await new Promise(r => setTimeout(r, 800)); // Step 1
        // Step 2 & 3 in logic

        const analysis = Logic.analyze(input);
        app.renderResults(input, analysis);
        app.saveToFirestore(input, analysis); // Fire and forget (it handles sync internally)

        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
    },

    renderResults: (input, analysis) => {
        const container = document.getElementById('citizen-results');
        container.classList.remove('hidden');

        const refId = 'REF-' + Math.floor(Math.random() * 100000);
        app.currentRefId = refId;
        document.getElementById('ref-id').innerText = refId;

        // UI Updates
        const riskText = document.getElementById('risk-text');
        const riskIcon = document.getElementById('risk-icon');
        const border = document.getElementById('result-card-border');
        const bar = document.getElementById('similarity-bar');
        const scoreText = document.getElementById('confidence-score');
        const timelineIcon = document.getElementById('timeline-final-icon');

        scoreText.innerText = `${analysis.score}% Risk`;
        bar.style.width = `${analysis.score}%`;

        // Color Logic
        let colorClass = 'gov-success';
        let borderColor = 'border-gov-success';
        let barColor = 'bg-gov-success';

        if (analysis.risk === 'High') {
            colorClass = 'text-gov-error';
            borderColor = 'border-gov-error';
            barColor = 'bg-gov-error';
            riskText.innerText = "High Risk - Likely Blocked";
            riskIcon.setAttribute('data-lucide', 'x-octagon');
            timelineIcon.className = "w-10 h-10 rounded-full bg-gov-error text-white flex items-center justify-center shadow-md mb-2";
        } else if (analysis.risk === 'Medium') {
            colorClass = 'text-yellow-600';
            borderColor = 'border-yellow-500';
            barColor = 'bg-yellow-500';
            riskText.innerText = "Medium Risk - Manual Check";
            riskIcon.setAttribute('data-lucide', 'alert-triangle');
            timelineIcon.className = "w-10 h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-md mb-2";
        } else {
            riskText.innerText = "Low Risk - Likely Approved";
            riskIcon.setAttribute('data-lucide', 'check-circle-2');
            timelineIcon.className = "w-10 h-10 rounded-full bg-gov-success text-white flex items-center justify-center shadow-md mb-2";
        }

        riskText.className = `text-xl font-bold ${colorClass}`;
        border.className = `md:col-span-2 govt-card p-6 border-l-8 ${borderColor}`;
        bar.className = `${barColor} h-2 rounded-full transition-all duration-1000`;

        // Details Injection
        const details = document.getElementById('ai-details');
        let html = ``;
        
        if (analysis.matches.length > 0) {
            html += `<div class="p-3 bg-red-50 border border-red-100 rounded mb-2">
                <h5 class="font-bold text-red-800 text-xs mb-1 uppercase">Similarity Conflict</h5>
                <ul class="list-disc ml-4 text-xs text-red-700">${analysis.matches.map(m => `<li>${m}</li>`).join('')}</ul>
            </div>`;
        }

        if (analysis.flags.length > 0) {
            html += `<div class="p-3 bg-yellow-50 border border-yellow-100 rounded">
                <h5 class="font-bold text-yellow-800 text-xs mb-1 uppercase">Policy Warnings</h5>
                <ul class="list-disc ml-4 text-xs text-yellow-700">${analysis.flags.map(f => `<li>${f}</li>`).join('')}</ul>
            </div>`;
        }

        if (analysis.matches.length === 0 && analysis.flags.length === 0) {
            html += `<div class="text-sm text-green-700 flex items-center gap-2"><i data-lucide="check" class="w-4 h-4"></i> No immediate conflicts found.</div>`;
        }

        details.innerHTML = html;
        lucide.createIcons();
    },

    saveToFirestore: async (title, analysis) => {
        const record = {
            title: title,
            score: analysis.score,
            risk: analysis.risk,
            flags: analysis.flags,
            matches: analysis.matches,
            refId: app.currentRefId,
            userId: app.currentUser ? app.currentUser.uid : 'anonymous',
            timestamp: new Date().toISOString(), // Use simple string for local compatibility
            status: 'Pending'
        };

        // 1. Always save to LocalStorage as backup
        try {
            const localHistory = JSON.parse(localStorage.getItem('patra_history') || '[]');
            localHistory.push(record);
            localStorage.setItem('patra_history', JSON.stringify(localHistory));
        } catch(e) { console.error("Local save failed", e); }

        // 2. Try Firestore if available
        if (!db || !app.currentUser) return;
        try {
            await db.collection('artifacts').doc(appId)
                    .collection('public').doc('data')
                    .collection('verification_logs').add({
                        ...record,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
        } catch (e) { console.error("Firestore save failed", e); }
    },

    // --- USER HISTORY (FIXED) ---
    loadUserHistory: () => {
        const tbody = document.getElementById('history-table-body');
        
        // --- CASE 1: No Database or No User ---
        if (!db || !app.currentUser) {
            // Try to load from LocalStorage
            const localData = JSON.parse(localStorage.getItem('patra_history') || '[]');
            // Sort local data descending
            localData.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            app.renderHistoryRows(localData);
            return;
        }
        
        // --- CASE 2: Real-time Firestore ---
        // Avoid setting multiple listeners
        if(app.historyUnsubscribe) return;

        app.historyUnsubscribe = db.collection('artifacts').doc(appId)
          .collection('public').doc('data')
          .collection('verification_logs')
          .where('userId', '==', app.currentUser.uid)
          .onSnapshot(snapshot => {
              let docs = [];
              snapshot.forEach(doc => {
                  let data = doc.data();
                  // Normalize timestamp
                  let ts = data.timestamp ? (data.timestamp.seconds * 1000) : Date.now();
                  docs.push({ ...data, _ts: ts });
              });
              
              // Client-side Sort (Newest first)
              docs.sort((a,b) => b._ts - a._ts);
              
              app.renderHistoryRows(docs);
          }, error => {
              console.error("History fetch error", error);
              // Fallback to local storage on error
              const localData = JSON.parse(localStorage.getItem('patra_history') || '[]');
              app.renderHistoryRows(localData);
          });
    },

    renderHistoryRows: (docs) => {
        const tbody = document.getElementById('history-table-body');
        if(!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">No verification history found.</td></tr>';
            return;
        }

        let html = '';
        docs.forEach(data => {
            const riskColor = data.risk === 'High' ? 'text-red-600' : (data.risk === 'Medium' ? 'text-yellow-600' : 'text-green-600');
            
            let dateStr = 'Just now';
            if(data.timestamp && typeof data.timestamp === 'string') {
                 dateStr = new Date(data.timestamp).toLocaleDateString();
            } else if(data.timestamp && data.timestamp.seconds) {
                 dateStr = new Date(data.timestamp.seconds * 1000).toLocaleDateString();
            }

            html += `
            <tr class="hover:bg-gray-50 border-b border-gray-100 transition">
                <td class="p-4 font-mono text-xs text-gray-500">${data.refId || '-'}</td>
                <td class="p-4 font-bold text-gray-800">${data.title}</td>
                <td class="p-4 text-xs text-gray-500">${dateStr}</td>
                <td class="p-4 text-xs">${data.score}%</td>
                <td class="p-4 text-xs font-bold ${riskColor}">${data.risk}</td>
                <td class="p-4"><span class="px-2 py-1 rounded-full bg-gray-100 text-xs font-bold text-gray-600">${data.status}</span></td>
            </tr>
            `;
        });
        tbody.innerHTML = html;
    },
    
    clearHistory: () => {
       localStorage.removeItem('patra_history');
       document.getElementById('history-table-body').innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">History cleared (Local). Refresh to clear server view if strictly required.</td></tr>';
    },

    // --- PUBLISHER TOOLS ---
    simulateTitle: () => {
        const input = document.getElementById('sim-input').value;
        const feedback = document.getElementById('sim-feedback');
        const bar = document.getElementById('sim-bar');
        
        if(!input) {
            bar.style.width = '0%';
            feedback.innerText = "-";
            return;
        }

        const analysis = Logic.analyze(input);
        bar.style.width = `${Math.max(5, analysis.score)}%`; // Min width for visibility

        if(analysis.score > 70) {
            bar.className = "h-full transition-all duration-300 bg-red-500";
            feedback.innerText = "High Risk";
            feedback.className = "text-center text-sm font-bold mt-2 text-red-600";
        } else if (analysis.score > 30) {
            bar.className = "h-full transition-all duration-300 bg-yellow-500";
            feedback.innerText = "Caution";
            feedback.className = "text-center text-sm font-bold mt-2 text-yellow-600";
        } else {
            bar.className = "h-full transition-all duration-300 bg-green-500";
            feedback.innerText = "Looks Good";
            feedback.className = "text-center text-sm font-bold mt-2 text-green-600";
        }
    },

    publisherCheck: () => {
        const input = document.getElementById('publisher-input').value;
        const list = document.getElementById('alternatives-list');
        if(!input) return;
        
        const alts = Logic.generateAlternatives(input);
        list.innerHTML = alts.map(a => `
            <div class="p-3 bg-gray-50 border border-gray-200 rounded flex justify-between items-center group hover:border-gov-blue transition">
                <span class="font-serif text-gov-text font-medium">${a}</span>
                <button class="text-xs text-gov-blue opacity-0 group-hover:opacity-100 font-bold" onclick="navigator.clipboard.writeText('${a}')">Copy</button>
            </div>
        `).join('');
    },

    // --- OFFICER TOOLS ---
    officerAuthenticated: false,

    officerLogin: () => {
        const pass = document.getElementById('officer-password').value;
        if (pass === 'admin123') {
            app.officerAuthenticated = true;
            document.getElementById('officer-login').classList.add('hidden');
            document.getElementById('officer-dashboard').classList.remove('hidden');
            app.fetchDashboardData(); // Trigger manual fetch if listener not ready
        } else {
            alert("Access Denied. Invalid credentials.");
        }
    },

    logout: () => {
        app.officerAuthenticated = false;
        app.navigate('citizen');
    },

    listenToOfficerData: () => {
        if (!db) return;
        db.collection('artifacts').doc(appId)
          .collection('public').doc('data')
          .collection('verification_logs')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .onSnapshot(snapshot => {
              const tbody = document.getElementById('dashboard-table-body');
              let html = '';
              let total = 0, highRisk = 0, pending = 0;

              snapshot.forEach(doc => {
                  const data = doc.data();
                  total++;
                  if (data.risk === 'High') highRisk++;
                  if (data.status === 'Pending') pending++;

                  const riskColor = data.risk === 'High' ? 'text-red-600 bg-red-50' : (data.risk === 'Medium' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50');
                  
                  html += `
                    <tr class="hover:bg-blue-50/50 transition border-b border-gray-100">
                        <td class="p-4 font-mono text-xs text-gray-500">${data.refId || 'N/A'}</td>
                        <td class="p-4 font-bold text-gray-800">${data.title}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold uppercase ${riskColor}">${data.risk}</span></td>
                        <td class="p-4 text-xs text-gray-500 max-w-xs truncate">${(data.flags||[]).length} Flags</td>
                        <td class="p-4 text-center">
                            ${data.status === 'Pending' ? `
                                <div class="flex justify-center gap-2">
                                    <button onclick="app.updateStatus('${doc.id}', 'Approved')" class="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><i data-lucide="check" class="w-4 h-4"></i></button>
                                    <button onclick="app.updateStatus('${doc.id}', 'Rejected')" class="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><i data-lucide="x" class="w-4 h-4"></i></button>
                                </div>
                            ` : `<span class="text-xs font-bold text-gray-600">${data.status}</span>`}
                        </td>
                    </tr>
                  `;
              });

              if(tbody) tbody.innerHTML = html || '<tr><td colspan="5" class="p-4 text-center text-gray-400">No recent activity.</td></tr>';
              
              document.getElementById('stat-total').innerText = total;
              document.getElementById('stat-risk').innerText = highRisk;
              document.getElementById('pending-count').innerText = pending;
              lucide.createIcons();
          });
    },

    fetchDashboardData: () => {
       // Fallback if db not connected
       if(!db && app.officerAuthenticated) {
           document.getElementById('dashboard-table-body').innerHTML = `
                <tr>
                    <td class="p-4 text-xs text-gray-500">REF-DEMO</td>
                    <td class="p-4 font-bold">The Police Journal</td>
                    <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold bg-red-50 text-red-600">High</span></td>
                    <td class="p-4 text-xs">Keywords</td>
                    <td class="p-4 text-center"><span class="text-xs font-bold text-red-600">Rejected</span></td>
                </tr>`;
           lucide.createIcons();
       }
    },

    updateStatus: async (docId, status) => {
        if(!db) return;
        try {
            await db.collection('artifacts').doc(appId)
                    .collection('public').doc('data')
                    .collection('verification_logs').doc(docId)
                    .update({ status: status });
        } catch(e) { console.error(e); }
    }
};

window.toggleElement = (id) => document.getElementById(id).classList.toggle('hidden');
window.onload = () => app.init();