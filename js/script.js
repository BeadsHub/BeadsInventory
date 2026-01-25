
<script>
    const ModelUsageManager = {
        baseLimitPerKey: 20,
        storageKey: 'ai_usage_data',
        defaultKey: "",
        
        defaultModels: [
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
        ],
        
        getData() {
            let data = null;
            try {
                data = JSON.parse(localStorage.getItem(this.storageKey));
            } catch (e) {
                data = null;
            }

            // Migration logic
            if (!data || !data.keys) {
                console.log('ModelUsageManager: Initializing or migrating to multi-key structure...');
                const oldApiKey = (data && data.apiKey) ? data.apiKey : this.defaultKey;
                const oldUsage = (data && data.usage) ? data.usage : {};
                const newId = Date.now().toString(); 
                
                return {
                    date: (data && data.date) ? data.date : new Date().toDateString(),
                    activeKeyId: newId,
                    keys: [{
                        id: newId,
                        name: '默认Key',
                        apiKey: oldApiKey,
                        usage: oldUsage
                    }],
                    modelOrder: [...this.defaultModels]
                };
            }
            
            // Ensure modelOrder exists
            if (!data.modelOrder) {
                data.modelOrder = [...this.defaultModels];
                this.saveData(data);
            }
            
            return data;
        },

        saveData(data) {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        },

        getPTDateTime() {
            // Returns YYYY-MM-DD HH:mm in Pacific Time
            return new Date().toLocaleDateString('en-CA', {
                timeZone: 'America/Los_Angeles',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '');
        },

        getPTDate() {
            // Returns YYYY-MM-DD in Pacific Time (America/Los_Angeles)
            // Works correctly for DST (PDT/PST)
            return new Date().toLocaleDateString('en-CA', {
                timeZone: 'America/Los_Angeles'
            }); // en-CA gives YYYY-MM-DD format
        },

        checkReset() {
            const data = this.getData();
            const today = this.getPTDate();
            if (data.date !== today) {
                console.log(`ModelUsageManager: New day detected (${today}). Resetting all usage.`);
                data.date = today;
                if (data.keys) {
                    data.keys.forEach(k => k.usage = {});
                }
                this.saveData(data);
            }
        },

        // --- Key Management ---
        getKeys() {
            return this.getData().keys;
        },
        
        getActiveKeyId() {
            return this.getData().activeKeyId;
        },
        
        getActiveKey() {
            const data = this.getData();
            return data.keys.find(k => k.id === data.activeKeyId) || data.keys[0];
        },
        
        setActiveKey(id) {
            const data = this.getData();
            if (data.keys.some(k => k.id === id)) {
                data.activeKeyId = id;
                this.saveData(data);
            }
        },
        
        addKey(name, apiKey) {
            const data = this.getData();
            const newId = Date.now().toString();
            data.keys.push({
                id: newId,
                name: name || '新 Key',
                apiKey: apiKey || '',
                usage: {}
            });
            if (data.keys.length === 1) {
                data.activeKeyId = newId;
            }
            this.saveData(data);
            return newId;
        },
        
        updateKey(id, updates) {
            const data = this.getData();
            const key = data.keys.find(k => k.id === id);
            if (key) {
                if (updates.name !== undefined) key.name = updates.name;
                if (updates.apiKey !== undefined) key.apiKey = updates.apiKey;
                this.saveData(data);
            }
        },
        
        deleteKey(id) {
            const data = this.getData();
            const idx = data.keys.findIndex(k => k.id === id);
            if (idx > -1) {
                data.keys.splice(idx, 1);
                
                if (data.activeKeyId === id) {
                    if (data.keys.length > 0) {
                        data.activeKeyId = data.keys[0].id;
                    } else {
                        const newId = Date.now().toString();
                        data.keys.push({ id: newId, name: '默认Key', apiKey: '', usage: {} });
                        data.activeKeyId = newId;
                    }
                }
                this.saveData(data);
            }
        },

        setKeyUsage(keyId, model, usage) {
            const data = this.getData();
            const key = data.keys.find(k => k.id === keyId);
            if (key) {
                let val = parseInt(usage);
                if (isNaN(val) || val < 0) val = 0;
                // Allow setting usage > baseLimitPerKey, but it will effectively be "used up"
                key.usage[model] = val;
                this.saveData(data);
            }
        },

        moveKey(id, direction) {
            const data = this.getData();
            const index = data.keys.findIndex(k => k.id === id);
            if (index === -1) return;

            if (direction === 'up' && index > 0) {
                // Swap with index - 1
                [data.keys[index], data.keys[index - 1]] = [data.keys[index - 1], data.keys[index]];
                this.saveData(data);
            } else if (direction === 'down' && index < data.keys.length - 1) {
                // Swap with index + 1
                [data.keys[index], data.keys[index + 1]] = [data.keys[index + 1], data.keys[index]];
                this.saveData(data);
            }
        },

        moveModel(modelName, direction) {
            const data = this.getData();
            if (!data.modelOrder) data.modelOrder = [...this.defaultModels];
            
            const index = data.modelOrder.indexOf(modelName);
            if (index === -1) return;

            if (direction === 'up' && index > 0) {
                [data.modelOrder[index], data.modelOrder[index - 1]] = [data.modelOrder[index - 1], data.modelOrder[index]];
                this.saveData(data);
            } else if (direction === 'down' && index < data.modelOrder.length - 1) {
                [data.modelOrder[index], data.modelOrder[index + 1]] = [data.modelOrder[index + 1], data.modelOrder[index]];
                this.saveData(data);
            }
        },

        renameModel(oldName, newName) {
            const data = this.getData();
            if (!data.modelOrder) data.modelOrder = [...this.defaultModels];
            
            const index = data.modelOrder.indexOf(oldName);
            if (index > -1 && newName && newName.trim() !== '') {
                data.modelOrder[index] = newName.trim();
                // Also migrate usage data if needed, but for now just rename the list item
                // Ideally we should rename keys in usage objects too, but that's complex. 
                // Since this is just a preference list, it's fine. 
                // However, if the user renames a model that has quota, the quota will be "lost" or reset for the new name.
                // Let's try to migrate usage too.
                if (data.keys) {
                    data.keys.forEach(k => {
                        if (k.usage && k.usage[oldName] !== undefined) {
                            k.usage[newName] = k.usage[oldName];
                            delete k.usage[oldName];
                        }
                    });
                }
                this.saveData(data);
            }
        },

        deleteModel(modelName) {
            const data = this.getData();
            if (!data.modelOrder) data.modelOrder = [...this.defaultModels];
            
            const index = data.modelOrder.indexOf(modelName);
            if (index > -1) {
                data.modelOrder.splice(index, 1);
                
                // Clean up usage data for this model from all keys
                if (data.keys) {
                    data.keys.forEach(k => {
                        if (k.usage && k.usage[modelName] !== undefined) {
                            delete k.usage[modelName];
                        }
                    });
                }
                
                this.saveData(data);
            }
        },

        // --- Global Usage Logic ---
        getModelList() {
            const data = this.getData();
            return data.modelOrder && data.modelOrder.length > 0 ? data.modelOrder : this.defaultModels;
        },

        setModelList(list) {
            const data = this.getData();
            data.modelOrder = list;
            this.saveData(data);
        },

        addModels(newModels) {
            const data = this.getData();
            let current = new Set(data.modelOrder || this.defaultModels);
            let added = false;
            
            newModels.forEach(m => {
                if (!current.has(m)) {
                    current.add(m);
                    added = true;
                }
            });

            if (added) {
                data.modelOrder = Array.from(current);
                this.saveData(data);
            }
            return data.modelOrder;
        },

        getGlobalLimit() {
            const keys = this.getKeys();
            return keys.length * this.baseLimitPerKey;
        },

        getGlobalUsage(model) {
            this.checkReset();
            const keys = this.getKeys();
            return keys.reduce((sum, k) => sum + (k.usage[model] || 0), 0);
        },

        setGlobalRemaining(model, remaining) {
            const data = this.getData();
            const globalLimit = data.keys.length * this.baseLimitPerKey;
            let targetUsed = globalLimit - parseInt(remaining);
            if (isNaN(targetUsed) || targetUsed < 0) targetUsed = 0;
            if (targetUsed > globalLimit) targetUsed = globalLimit;

            // Distribute usage across keys
            data.keys.forEach(k => k.usage[model] = 0);
            
            let remainingToDistribute = targetUsed;
            for (let k of data.keys) {
                if (remainingToDistribute <= 0) break;
                let fill = Math.min(remainingToDistribute, this.baseLimitPerKey);
                k.usage[model] = fill;
                remainingToDistribute -= fill;
            }
            this.saveData(data);
        },

        resetAll() {
             const data = this.getData();
             data.keys.forEach(k => k.usage = {});
             this.saveData(data);
        },

        // --- Key Management & Usage ---
        // Returns { apiKey: string, keyId: string } or null
        getUsableKeyObj(model) {
            this.checkReset();
            const data = this.getData();
            // If model specified, find first key with quota
            if (model) {
                const validKey = data.keys.find(k => (k.usage[model] || 0) < this.baseLimitPerKey);
                if (validKey) return { apiKey: validKey.apiKey, keyId: validKey.id };
            }
            // Fallback: Return active key or first key
            const key = data.keys.find(k => k.id === data.activeKeyId) || data.keys[0];
            return key ? { apiKey: key.apiKey, keyId: key.id } : null;
        },

        getApiKey(model) {
             const keyObj = this.getUsableKeyObj(model);
             return keyObj ? keyObj.apiKey : '';
        },

        canUse(model) {
            this.checkReset();
            const data = this.getData();
            // Check if ANY key has quota for this model
            return data.keys.some(k => (k.usage[model] || 0) < this.baseLimitPerKey);
        },

        increment(model, keyId) {
            this.checkReset();
            const data = this.getData();
            let key;
            
            if (keyId) {
                // Precise increment based on used key
                key = data.keys.find(k => k.id === keyId);
            }
            
            // Fallback logic if no keyId provided or key not found (legacy safety)
            if (!key) {
                key = data.keys.find(k => (k.usage[model] || 0) < this.baseLimitPerKey);
            }
            
            if (key) {
                key.usage[model] = (key.usage[model] || 0) + 1;
                this.saveData(data);
            } else {
                // Should not happen if canUse was checked, but fallback to active
                const active = data.keys.find(k => k.id === data.activeKeyId);
                if (active) {
                    active.usage[model] = (active.usage[model] || 0) + 1;
                    this.saveData(data);
                }
            }
        },
        
        getUsage(model) {
            // Legacy/Fallback helper
            return this.getGlobalUsage(model);
        },

        async logAvailableModels() {
            const apiKey = this.getApiKey();
            if (!apiKey) return;
            console.log("Checking available models...");
            try {
                // Try to list models to see exact names
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const data = await response.json();
                if (data.models) {
                    console.log("=== Available Gemini Models (API) ===");
                    const simplified = data.models.map(m => ({
                        id: m.name.replace('models/', ''),
                        displayName: m.displayName,
                        methods: m.supportedGenerationMethods
                    }));
                    console.table(simplified);
                }
            } catch (e) {
                console.warn("Failed to list models:", e);
            }
        }
    };

    // Initialize immediately
    ModelUsageManager.checkReset();
    localStorage.removeItem('ai_model_usage_v1');

    function openAIUsageModal() {
        ModelUsageManager.checkReset();
        
        const ptDateTime = ModelUsageManager.getPTDateTime();
        document.getElementById('aiUsageDate').innerText = `${ptDateTime.replace(/-/g, '/')} (Pacific Time)`;

        switchAITab('quota');
        showModal('aiUsageModal');
        
        // Diagnostic: Log available models to help debug naming issues
        ModelUsageManager.logAvailableModels();
    }

    function switchAITab(tabName) {
        // Update Tabs UI
        ['quota', 'keys', 'models'].forEach(t => {
            const btn = document.getElementById(`tab-btn-${t}`);
            const content = document.getElementById(`tab-content-${t}`);
            
            if (btn && content) {
                if (t === tabName) {
                    btn.className = 'ai-tab active';
                    btn.style.color = '#4a90e2';
                    btn.style.borderBottomColor = '#4a90e2';
                    content.style.display = 'block';
                } else {
                    btn.className = 'ai-tab';
                    btn.style.color = '#666';
                    btn.style.borderBottomColor = 'transparent';
                    content.style.display = 'none';
                }
            }
        });

        if (tabName === 'quota') {
            renderQuotaTab();
        } else if (tabName === 'keys') {
            renderAIKeyList();
        } else if (tabName === 'models') {
            renderModelCollectionTab();
        }
    }

    function renderQuotaTab() {
        const globalLimit = ModelUsageManager.getGlobalLimit();
        const limitEl = document.getElementById('totalDailyLimit');
        if(limitEl) limitEl.innerText = globalLimit;

        const list = document.getElementById('quotaList');
        if(!list) return;
        list.innerHTML = '';

        const models = ModelUsageManager.getModelList();
        
        models.forEach(model => {
            const used = ModelUsageManager.getGlobalUsage(model);
            const remaining = globalLimit - used;
            
            const rowWrapper = document.createElement('div');
            rowWrapper.style.borderBottom = '1px dashed #eee';
            if (models.indexOf(model) === models.length - 1) rowWrapper.style.borderBottom = 'none';

            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0;';
            
            row.innerHTML = `
                <div style="flex:1; padding-right: 4px; min-width: 0;">
                    <span style="font-weight: bold; color: #333; font-size:13px; word-break: break-word; line-height: 1.2;">${model}</span>
                </div>
                
                <button onclick="toggleUsageDetails('${model}')" style="background:none; border:none; cursor:pointer; color:#4a90e2; padding:4px; display:flex; align-items:center; justify-content: center; flex-shrink:0; margin-right: 4px;" title="查看详情">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </button>

                <div style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
                    <span style="font-size:11px; color:#666; white-space:nowrap;">剩余:</span>
                    <input type="number" value="${remaining}" 
                           onchange="updateGlobalRemaining('${model}', this.value)"
                           style="width: 50px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px; font-weight:bold; color:#4a90e2; font-size:13px;">
                    <span style="color: #999; font-size: 11px; white-space:nowrap;">/ ${globalLimit}</span>
                </div>
            `;
            
            const detailsDiv = document.createElement('div');
            detailsDiv.id = `details-${model}`;
            detailsDiv.style.display = 'none';
            detailsDiv.style.backgroundColor = '#f0f7ff';
            detailsDiv.style.padding = '8px';
            detailsDiv.style.borderRadius = '6px';
            detailsDiv.style.marginBottom = '8px';
            detailsDiv.style.fontSize = '12px';
            detailsDiv.style.color = '#555';

            rowWrapper.appendChild(row);
            rowWrapper.appendChild(detailsDiv);
            list.appendChild(rowWrapper);
        });
    }

    function toggleUsageDetails(model) {
        const el = document.getElementById(`details-${model}`);
        if (!el) return;
        
        if (el.style.display === 'none') {
            // Render details
            const keys = ModelUsageManager.getKeys();
            let html = '<div style="font-weight:bold; margin-bottom:4px; color:#4a90e2;">各 Key 使用详情:</div>';
            
            if (keys.length === 0) {
                html += '<div>暂无 Key</div>';
            } else {
                keys.forEach(k => {
                    const u = (k.usage && k.usage[model]) ? k.usage[model] : 0;
                    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                        <span>${k.name}</span>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="font-size:12px; color:#666;">已用:</span>
                            <input type="number" value="${u}" 
                                   onchange="updateKeyUsage('${k.id}', '${model}', this.value)"
                                   style="width: 50px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px; font-size:12px; color:#333;">
                        </div>
                    </div>`;
                });
            }
            
            el.innerHTML = html;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    function updateKeyUsage(keyId, model, val) {
        ModelUsageManager.setKeyUsage(keyId, model, val);
        renderQuotaTab(); // Re-render to update global remaining
        // Re-open details
        const el = document.getElementById(`details-${model}`);
        if(el) el.style.display = 'none'; // toggleUsageDetails will open it
        toggleUsageDetails(model);
    }

    function updateGlobalRemaining(model, val) {
        ModelUsageManager.setGlobalRemaining(model, val);
        renderQuotaTab();
    }
    
    function resetAllAIUsage() {
        showModal('resetQuotaConfirmModal');
    }

    function closeResetConfirmModal() {
        document.getElementById('resetQuotaConfirmModal').style.display = 'none';
    }

    function executeResetAllAIUsage() {
        ModelUsageManager.resetAll();
        renderQuotaTab();
        showToast('已重置所有额度');
        closeResetConfirmModal();
    }

    const ICON_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const ICON_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    function renderAIKeyList() {
        const listEl = document.getElementById('aiKeyList');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        let keys = ModelUsageManager.getKeys();
        
        keys.forEach((k, index) => {
            const div = document.createElement('div');
            div.className = 'ai-key-item';
            div.style.cssText = `
                display: flex; flex-direction: column; gap: 8px; 
                padding: 12px; border-radius: 10px; border: 1px solid #e0e0e0;
                background: #fff; margin-bottom: 10px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            `;
            
            const isFirst = index === 0;
            const isLast = index === keys.length - 1;

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; display:flex; align-items:center; justify-content:center; background:#f0f2f5; border-radius:50%; color:#666; font-size:12px; font-weight:bold;">${index + 1}</div>
                    <input type="text" value="${k.name}" placeholder="Key名称" 
                           onchange="updateKeyName('${k.id}', this.value)"
                           style="flex: 1; border: none; background: transparent; font-weight: bold; color: #333; font-size: 15px; outline: none; border-bottom: 1px dashed transparent;"
                           onfocus="this.style.borderBottomColor='#4a90e2'" onblur="this.style.borderBottomColor='transparent'">
                    
                    <div style="display:flex; gap:2px;">
                        <button onclick="moveKey('${k.id}', 'up')" ${isFirst ? 'disabled' : ''} style="color: ${isFirst ? '#ccc' : '#666'}; background: none; border: none; cursor: ${isFirst ? 'default' : 'pointer'}; padding: 4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button onclick="moveKey('${k.id}', 'down')" ${isLast ? 'disabled' : ''} style="color: ${isLast ? '#ccc' : '#666'}; background: none; border: none; cursor: ${isLast ? 'default' : 'pointer'}; padding: 4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                    </div>

                    <button onclick="deleteKey('${k.id}')" style="color: #ff4d4f; background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 5px; margin-left:5px;">&times;</button>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; background: #f9f9f9; padding: 6px 10px; border-radius: 6px; border: 1px solid #eee;">
                    <span style="font-size: 12px; color: #999; font-weight: bold;">Key</span>
                    <input type="password" value="${k.apiKey}" placeholder="AIza..." 
                           onchange="updateKeyVal('${k.id}', this.value)"
                           style="flex: 1; border: none; font-size: 12px; font-family: monospace; color: #555; outline: none; background: transparent;">
                    <button onclick="toggleKeyVis(this)" style="background:none; border:none; cursor:pointer; font-size:14px; padding:0; display:flex; align-items:center; color: #bbb;">${ICON_EYE}</button>
                </div>
            `;
            
            listEl.appendChild(div);
        });
    }

    function moveKey(id, direction) {
        ModelUsageManager.moveKey(id, direction);
        renderAIKeyList();
    }

    function toggleKeyVis(btn) {
        const input = btn.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = ICON_EYE_OFF;
                btn.style.color = '#4a90e2';
            } else {
                input.type = 'password';
                btn.innerHTML = ICON_EYE;
                btn.style.color = '#bbb';
            }
        }
    }

    function toggleAddKeyForm() {
        const form = document.getElementById('addKeyForm');
        if (form.style.display === 'none') {
            form.style.display = 'block';
            document.getElementById('newKeyName').focus();
        } else {
            form.style.display = 'none';
        }
    }

    function saveNewKey() {
        const nameInput = document.getElementById('newKeyName');
        const valInput = document.getElementById('newKeyVal');
        const name = nameInput.value.trim();
        const key = valInput.value.trim();
        
        if (!key) {
            alert('请输入 API Key');
            return;
        }
        
        ModelUsageManager.addKey(name || '新 Key', key);
        
        // Reset and hide form
        nameInput.value = '';
        valInput.value = '';
        toggleAddKeyForm();
        
        // Refresh list
        renderAIKeyList();
    }

    function selectKey(id) {
        ModelUsageManager.setActiveKey(id);
        renderAIKeyList(); // Re-render to update styling
    }

    function updateKeyName(id, val) {
        ModelUsageManager.updateKey(id, { name: val });
    }

    function updateKeyVal(id, val) {
        ModelUsageManager.updateKey(id, { apiKey: val });
    }

    let pendingDeleteKeyId = null;

    function deleteKey(id) {
        pendingDeleteKeyId = id;
        showModal('deleteKeyConfirmModal');
    }

    function confirmDeleteKey() {
        if (pendingDeleteKeyId) {
            ModelUsageManager.deleteKey(pendingDeleteKeyId);
            renderAIKeyList();
            pendingDeleteKeyId = null;
        }
        // Only close the confirmation modal, keep the main modal open
        const modal = document.getElementById('deleteKeyConfirmModal');
        if (modal) modal.style.display = 'none';
    }

    // --- Model Collection Management ---
    function renderModelCollectionTab() {
        const listEl = document.getElementById('modelListContainer');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        const models = ModelUsageManager.getModelList();
        
        models.forEach((model, index) => {
            const div = document.createElement('div');
            div.className = 'model-item';
            div.style.cssText = `
                display: flex; align-items: center; gap: 8px; 
                padding: 12px; border-radius: 10px; border: 1px solid #e0e0e0;
                background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            `;
            
            const isFirst = index === 0;
            const isLast = index === models.length - 1;

            div.innerHTML = `
                <div style="width: 24px; height: 24px; display:flex; align-items:center; justify-content:center; background:#f0f2f5; border-radius:50%; color:#666; font-size:12px; font-weight:bold; flex-shrink: 0;">${index + 1}</div>
                
                <div style="flex:1; margin-left: 8px; word-break: break-word; font-weight:bold; color:#333; font-size:13px; line-height: 1.2;">
                    ${model}
                </div>
                
                <div style="display:flex; align-items:center; gap:4px; margin-left:8px;">
                     <button onclick="renameModelFromUI('${model}')" style="background:none; border:none; cursor:pointer; color:#4a90e2; padding:6px; display:flex; align-items:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    
                    <button onclick="moveModelUI('${model}', 'up')" ${isFirst ? 'disabled' : ''} style="color: ${isFirst ? '#ccc' : '#666'}; background: none; border: none; cursor: ${isFirst ? 'default' : 'pointer'}; padding: 6px; display:flex; align-items:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    
                    <button onclick="moveModelUI('${model}', 'down')" ${isLast ? 'disabled' : ''} style="color: ${isLast ? '#ccc' : '#666'}; background: none; border: none; cursor: ${isLast ? 'default' : 'pointer'}; padding: 6px; display:flex; align-items:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>

                    <button onclick="deleteModelFromUI('${model}')" style="color: #ff4d4f; background: none; border: none; font-size: 18px; cursor: pointer; padding: 6px; display:flex; align-items:center; margin-left: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            
            listEl.appendChild(div);
        });
    }

    function moveModelUI(model, direction) {
        ModelUsageManager.moveModel(model, direction);
        renderModelCollectionTab();
    }

    function addModelFromUI() {
        currentModelEditMode = 'add';
        document.getElementById('modelEditTitle').innerText = '添加模型';
        document.getElementById('modelNameInput').value = '';
        showModal('modelEditModal');
        setTimeout(() => document.getElementById('modelNameInput').focus(), 50);
    }

    function renameModelFromUI(oldName) {
        currentModelEditMode = 'rename';
        currentModelOldName = oldName;
        document.getElementById('modelEditTitle').innerText = '重命名模型';
        document.getElementById('modelNameInput').value = oldName;
        showModal('modelEditModal');
        setTimeout(() => document.getElementById('modelNameInput').focus(), 50);
    }

    function closeModelEditModal() {
        document.getElementById('modelEditModal').style.display = 'none';
        const mask2 = document.getElementById('mask2');
        // If mask2 is visible, hide it (nested case)
        if (mask2 && mask2.style.display === 'block') {
            mask2.style.display = 'none';
        } else {
            // Otherwise, we might be the only modal, check if any others are open
            // If no other modals are open, hide the main mask
            const openModals = Array.from(document.querySelectorAll('.modal')).filter(el => el.style.display === 'block');
            if (openModals.length === 0) {
                document.getElementById('mask').style.display = 'none';
            }
        }
    }

    function submitModelEdit() {
        const nameInput = document.getElementById('modelNameInput');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('请输入模型名称');
            return;
        }

        if (currentModelEditMode === 'add') {
            // Check if exists
            const existing = ModelUsageManager.getModelList();
            if (existing.includes(name)) {
                alert('该模型已存在');
                return;
            }
            ModelUsageManager.addModels([name]);
            
            // Show success feedback
            showToast(`模型 "${name}" 添加成功`);
            
            // Close modal after success
            renderModelCollectionTab();
            renderQuotaTab();
            closeModelEditModal();
            
        } else if (currentModelEditMode === 'rename') {
            if (name !== currentModelOldName) {
                const existing = ModelUsageManager.getModelList();
                if (existing.includes(name)) {
                    alert('该模型名已存在');
                    return;
                }
                ModelUsageManager.renameModel(currentModelOldName, name);
            }
            renderModelCollectionTab();
            renderQuotaTab();
            closeModelEditModal();
        }
    }

    function deleteModelFromUI(modelName) {
        // currentModelToDelete = modelName; // Deprecated global var usage
        const btn = document.getElementById('btnConfirmDeleteModel');
        if(btn) btn.setAttribute('data-model', modelName);
        
        document.getElementById('modelDeleteMsg').innerText = `确定要删除模型 "${modelName}" 吗？\n删除后将不再调用该模型。`;
        showModal('modelDeleteModal');
    }

    function closeModelDeleteModal() {
        document.getElementById('modelDeleteModal').style.display = 'none';
        const mask2 = document.getElementById('mask2');
        if (mask2) mask2.style.display = 'none';
    }

    function confirmDeleteModel() {
        const btn = document.getElementById('btnConfirmDeleteModel');
        const modelName = btn ? btn.getAttribute('data-model') : null;
        
        if (modelName) {
            try {
                ModelUsageManager.deleteModel(modelName);
                renderModelCollectionTab();
                renderQuotaTab();
                closeModelDeleteModal();
                showToast(`模型 "${modelName}" 已删除`);
            } catch (e) {
                console.error("Delete failed", e);
                alert("删除失败: " + e.message);
            }
        }
    }

    function updatePullToRefresh(page) {
        // 手机端：扫描页面禁用下拉刷新 (prevent pull-to-refresh)
        if (page === 'scan') {
            document.body.style.overscrollBehaviorY = 'contain';
        } else {
            document.body.style.overscrollBehaviorY = 'auto';
        }
    }

    function navTo(page) {
        // Save state for refresh
        localStorage.setItem('mard_last_nav', JSON.stringify({ method: 'navTo', arg: page }));
        
        // Update Pull-to-Refresh behavior
        updatePullToRefresh(page);

        document.getElementById('page-home').style.display = 'none';
        document.getElementById('page-beads').style.display = 'none';
        document.getElementById('page-fabric').style.display = 'none';
        document.getElementById('page-stats').style.display = 'none';
        document.getElementById('page-scan').style.display = 'none';

        
        // Hide dock by default, show only for main pages
        document.getElementById('footer-dock').style.display = 'none';
        
        // Handle FAB visibility
        const fab = document.getElementById('floatingBatchAddBtn');
        if(fab) fab.style.display = (page === 'beads') ? 'flex' : 'none';

        const homeBtn = document.getElementById('floatingHomeBtn');
        if(homeBtn) homeBtn.style.display = (page === 'beads') ? 'flex' : 'none';

        if (page === 'home') {
            document.getElementById('page-home').style.display = 'flex';
        } else if (page === 'beads') {
            document.getElementById('page-beads').style.display = 'block';
            document.getElementById('footer-dock').style.display = 'flex'; // Show dock
            checkWelcome();
        } else if (page === 'scan') {
            document.getElementById('page-scan').style.display = 'block';
            document.getElementById('footer-dock').style.display = 'flex';

        } else if (page === 'fabric') {
            document.getElementById('page-fabric').style.display = 'block';
            // Dock remains hidden for fabric page
            
            // Restore Fabric State
            const savedSpecs = localStorage.getItem('fabric_specs');
            if (savedSpecs) {
                specs = JSON.parse(savedSpecs);
                // Force update colors to match current theme (Fixes issue where Spec 3 might be purple)
                if (typeof specColors !== 'undefined') {
                    specs.forEach((s, i) => {
                        if (i < specColors.length) {
                            s.color = specColors[i];
                        }
                    });
                }
            }
            
            // If no specs (first time or cleared), add default
            if(specs.length === 0) {
                addSpec(); 
            } else {
                renderSpecs();
            }

            const savedW = localStorage.getItem('fabric_w');
            const savedH = localStorage.getItem('fabric_h');
            if (savedW) document.getElementById('canvasW').value = savedW;
            if (savedH) document.getElementById('canvasH').value = savedH;
            
            // Restore sort pref after specs are rendered (options need specs)
            setTimeout(() => {
                const savedSort = localStorage.getItem('fabric_sort');
                if (savedSort) {
                     const sortEl = document.getElementById('sortPref');
                     if(sortEl) sortEl.value = savedSort;
                }
                
                // Auto-calculate if data exists (User request: show last operation info)
                if (savedW && savedH && specs.length > 0) {
                    // Check if inputs are valid numbers
                    if (parseFloat(savedW) > 0 && parseFloat(savedH) > 0) {
                        // Check if all specs have valid dimensions
                        const allSpecsValid = specs.every(s => s.w > 0 && s.h > 0);
                        if (allSpecsValid) {
                             // Small delay to ensure UI is ready
                             calculateLayout();
                        }
                    }
                }
            }, 50);
        }
    }

    function showToast(msg, duration = 2000) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.8); color:white; padding:12px 24px; border-radius:8px; font-size:14px; z-index:9999; text-align:center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: fadeIn 0.2s;';
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, duration);
    }

    function openThresholdModal() {
        document.getElementById('thresholdInput').value = threshold;
        showModal('thresholdModal');
        setTimeout(() => document.getElementById('thresholdInput').focus(), 50);
    }

    function saveThreshold() {
        const input = document.getElementById('thresholdInput');
        const val = parseFloat(input.value);
        
        if (!isNaN(val) && val >= 0) {
            threshold = val;
            localStorage.setItem('bead_threshold', threshold);
            render();
            closeAllModals();
            
            showToast(`阈值已更新为 ${threshold}g`);
        } else {
            alert("请输入有效的数字");
        }
    }





    const MARD_DB = [
        {id:'A1',hex:'#faf5cd'},{id:'A2',hex:'#fcfed6'},{id:'A3',hex:'#fcff92'},{id:'A4',hex:'#f7ec5c'},{id:'A5',hex:'#f0d83a'},{id:'A6',hex:'#fda951'},{id:'A7',hex:'#fa8c4f'},{id:'A8',hex:'#fbda4d'},{id:'A9',hex:'#f79d5f'},{id:'A10',hex:'#f47e38'},{id:'A11',hex:'#fedb99'},{id:'A12',hex:'#fda276'},{id:'A13',hex:'#fec667'},{id:'A14',hex:'#f75842'},{id:'A15',hex:'#fbf65e'},{id:'A16',hex:'#feff97'},{id:'A17',hex:'#fde173'},{id:'A18',hex:'#fcbf80'},{id:'A19',hex:'#fd7e77'},{id:'A20',hex:'#f9d66e'},{id:'A21',hex:'#fae393'},{id:'A22',hex:'#edf878'},{id:'A23',hex:'#e4c8ba'},{id:'A24',hex:'#f3f6a9'},{id:'A25',hex:'#ffd785'},{id:'A26',hex:'#ffc734'},
        {id:'B1',hex:'#dff13b'},{id:'B2',hex:'#64f343'},{id:'B3',hex:'#a1f586'},{id:'B4',hex:'#5fdf34'},{id:'B5',hex:'#39e158'},{id:'B6',hex:'#64e0a4'},{id:'B7',hex:'#3eae7c'},{id:'B8',hex:'#1d9b54'},{id:'B9',hex:'#2a5037'},{id:'B10',hex:'#9ad1ba'},{id:'B11',hex:'#627032'},{id:'B12',hex:'#1a6e3d'},{id:'B13',hex:'#c8e87d'},{id:'B14',hex:'#abe84f'},{id:'B15',hex:'#305335'},{id:'B16',hex:'#c0ed9c'},{id:'B17',hex:'#9eb33e'},{id:'B18',hex:'#e6ed4f'},{id:'B19',hex:'#26b78e'},{id:'B20',hex:'#cbeccf'},{id:'B21',hex:'#18616a'},{id:'B22',hex:'#0a4241'},{id:'B23',hex:'#343b1a'},{id:'B24',hex:'#e8faa6'},{id:'B25',hex:'#4e846d'},{id:'B26',hex:'#907c35'},{id:'B27',hex:'#d0e0af'},{id:'B28',hex:'#9ee5bb'},{id:'B29',hex:'#c6df5f'},{id:'B30',hex:'#e3fbb1'},{id:'B31',hex:'#b4e691'},{id:'B32',hex:'#92ad60'},
        {id:'C1',hex:'#f0fee4'},{id:'C2',hex:'#abf8fe'},{id:'C3',hex:'#a2e0f7'},{id:'C4',hex:'#44cdfb'},{id:'C5',hex:'#06aadf'},{id:'C6',hex:'#54a7e9'},{id:'C7',hex:'#3977ca'},{id:'C8',hex:'#0f52bd'},{id:'C9',hex:'#3349c3'},{id:'C10',hex:'#3cbce3'},{id:'C11',hex:'#2aded3'},{id:'C12',hex:'#1e334e'},{id:'C13',hex:'#cde7fe'},{id:'C14',hex:'#d5fcf7'},{id:'C15',hex:'#21c5c4'},{id:'C16',hex:'#1858a2'},{id:'C17',hex:'#02d1f3'},{id:'C18',hex:'#213244'},{id:'C19',hex:'#18869d'},{id:'C20',hex:'#1a70a9'},{id:'C21',hex:'#bcddfc'},{id:'C22',hex:'#6bb1bb'},{id:'C23',hex:'#c8e2fd'},{id:'C24',hex:'#7ec5f9'},{id:'C25',hex:'#a9e8e0'},{id:'C26',hex:'#42adcf'},{id:'C27',hex:'#d0def9'},{id:'C28',hex:'#bdcee8'},{id:'C29',hex:'#364a89'},
        {id:'D1',hex:'#acb7ef'},{id:'D2',hex:'#868dd3'},{id:'D3',hex:'#3554af'},{id:'D4',hex:'#162d7b'},{id:'D5',hex:'#b34ec6'},{id:'D6',hex:'#b37bdc'},{id:'D7',hex:'#8758a9'},{id:'D8',hex:'#e3d2fe'},{id:'D9',hex:'#d5b9f4'},{id:'D10',hex:'#301a49'},{id:'D11',hex:'#beb9e2'},{id:'D12',hex:'#dc99ce'},{id:'D13',hex:'#b5038d'},{id:'D14',hex:'#862993'},{id:'D15',hex:'#2f1f8c'},{id:'D16',hex:'#e2e4f0'},{id:'D17',hex:'#c7d3f9'},{id:'D18',hex:'#9a64b8'},{id:'D19',hex:'#d8c2d9'},{id:'D20',hex:'#9a35ad'},{id:'D21',hex:'#940595'},{id:'D22',hex:'#333a95'},{id:'D23',hex:'#eadbf8'},{id:'D24',hex:'#768ae1'},{id:'D25',hex:'#4950c2'},{id:'D26',hex:'#d6c6eb'},
        {id:'E1',hex:'#f6d4cb'},{id:'E2',hex:'#fcc1dd'},{id:'E3',hex:'#f6bde8'},{id:'E4',hex:'#e8649e'},{id:'E5',hex:'#f0569f'},{id:'E6',hex:'#eb4172'},{id:'E7',hex:'#c53674'},{id:'E8',hex:'#fddbe9'},{id:'E9',hex:'#e376c7'},{id:'E10',hex:'#d13b95'},{id:'E11',hex:'#f7dad4'},{id:'E12',hex:'#f693bf'},{id:'E13',hex:'#b5026a'},{id:'E14',hex:'#fad4bf'},{id:'E15',hex:'#f5c9ca'},{id:'E16',hex:'#fbf4ec'},{id:'E17',hex:'#f7e3ec'},{id:'E18',hex:'#f9c8db'},{id:'E19',hex:'#f6bbd1'},{id:'E20',hex:'#d7c6ce'},{id:'E21',hex:'#c09da4'},{id:'E22',hex:'#b38c9f'},{id:'E23',hex:'#937d8a'},{id:'E24',hex:'#debee5'},
        {id:'F1',hex:'#fe9381'},{id:'F2',hex:'#f63d4b'},{id:'F3',hex:'#ee4e3e'},{id:'F4',hex:'#fb2a40'},{id:'F5',hex:'#e10328'},{id:'F6',hex:'#913635'},{id:'F7',hex:'#911932'},{id:'F8',hex:'#bb0126'},{id:'F9',hex:'#e0677a'},{id:'F10',hex:'#874628'},{id:'F11',hex:'#592323'},{id:'F12',hex:'#f3536b'},{id:'F13',hex:'#f45c45'},{id:'F14',hex:'#fcadb2'},{id:'F15',hex:'#d50527'},{id:'F16',hex:'#f8c0a9'},{id:'F17',hex:'#e89b7d'},{id:'F18',hex:'#d07f4a'},{id:'F19',hex:'#be454a'},{id:'F20',hex:'#c69495'},{id:'F21',hex:'#f2b8c6'},{id:'F22',hex:'#f7c3d0'},{id:'F23',hex:'#ed806c'},{id:'F24',hex:'#e09daf'},{id:'F25',hex:'#e84854'},
        {id:'G1',hex:'#ffe4d3'},{id:'G2',hex:'#fcc6ac'},{id:'G3',hex:'#f1c4a5'},{id:'G4',hex:'#dcb387'},{id:'G5',hex:'#e7b34e'},{id:'G6',hex:'#e3a014'},{id:'G7',hex:'#985c3a'},{id:'G8',hex:'#713d2f'},{id:'G9',hex:'#e4b685'},{id:'G10',hex:'#da8c42'},{id:'G11',hex:'#dac898'},{id:'G12',hex:'#fec993'},{id:'G13',hex:'#b2714b'},{id:'G14',hex:'#8b684c'},{id:'G15',hex:'#f6f8e3'},{id:'G16',hex:'#f2d8c1'},{id:'G17',hex:'#77544e'},{id:'G18',hex:'#ffe3d5'},{id:'G19',hex:'#dd7d41'},{id:'G20',hex:'#a5452f'},{id:'G21',hex:'#b38561'},
        {id:'H1',hex:'#ffffff'},{id:'H2',hex:'#fbfbfb'},{id:'H3',hex:'#b4b4b4'},{id:'H4',hex:'#878787'},{id:'H5',hex:'#464646'},{id:'H6',hex:'#2c2c2c'},{id:'H7',hex:'#010101'},{id:'H8',hex:'#e7d6dc'},{id:'H9',hex:'#efedee'},{id:'H10',hex:'#ebebeb'},{id:'H11',hex:'#cdcdcd'},{id:'H12',hex:'#fdf6ee'},{id:'H13',hex:'#f4efd1'},{id:'H14',hex:'#ced7d4'},{id:'H15',hex:'#9aa6a6'},{id:'H16',hex:'#1b1213'},{id:'H17',hex:'#f0eeef'},{id:'H18',hex:'#fcfff6'},{id:'H19',hex:'#f2eee5'},{id:'H20',hex:'#96a09f'},{id:'H21',hex:'#f8fbe6'},{id:'H22',hex:'#cacad2'},{id:'H23',hex:'#9b9c94'},
        {id:'M1',hex:'#bbc6b6'},{id:'M2',hex:'#909994'},{id:'M3',hex:'#697e81'},{id:'M4',hex:'#e0d4bc'},{id:'M5',hex:'#d1ccaf'},{id:'M6',hex:'#b0aa86'},{id:'M7',hex:'#b0a796'},{id:'M8',hex:'#ae8082'},{id:'M9',hex:'#a68862'},{id:'M10',hex:'#c4b3bb'},{id:'M11',hex:'#9d7693'},{id:'M12',hex:'#644b51'},{id:'M13',hex:'#c79266'},{id:'M14',hex:'#c27563'},{id:'M15',hex:'#747d7a'},
        // P系列 (珠光)
        {id:'P1',hex:'#F9F9F9'},{id:'P2',hex:'#ABABAB'},{id:'P3',hex:'#B6DBAF'},{id:'P4',hex:'#FEA2A3'},{id:'P5',hex:'#EB903F'},{id:'P6',hex:'#63CEA2'},{id:'P7',hex:'#E79273'},{id:'P8',hex:'#ECDB59'},{id:'P9',hex:'#DBD9DA'},{id:'P10',hex:'#DBC7EA'},{id:'P11',hex:'#F1E9D4'},{id:'P12',hex:'#E9EDEE'},{id:'P13',hex:'#ADCBF1'},{id:'P14',hex:'#337BAD'},{id:'P15',hex:'#668575'},{id:'P16',hex:'#FDC24E'},{id:'P17',hex:'#FDA42E'},{id:'P18',hex:'#FEBDA7'},{id:'P19',hex:'#FFDEE9'},{id:'P20',hex:'#FCBFD1'},{id:'P21',hex:'#E8BEC2'},{id:'P22',hex:'#DFAAA4'},{id:'P23',hex:'#A3656A'},
        // Q系列 (温变)
        {id:'Q1',hex:'#F2A5E8'},{id:'Q2',hex:'#E9EC91'},{id:'Q3',hex:'#FFFF00'},{id:'Q4',hex:'#FFEBFA'},{id:'Q5',hex:'#76CEDE'},
        // R系列 (透明果冻水晶)
        {id:'R1',hex:'#D40E1F'},{id:'R2',hex:'#F13484'},{id:'R3',hex:'#FB852B'},{id:'R4',hex:'#F8ED33'},{id:'R5',hex:'#32C958'},{id:'R6',hex:'#1EBA93'},{id:'R7',hex:'#1D779C'},{id:'R8',hex:'#1960C8'},{id:'R9',hex:'#945AB1'},{id:'R10',hex:'#F8DA54'},{id:'R11',hex:'#FCECF7'},{id:'R12',hex:'#D8D4D3'},{id:'R13',hex:'#56534E'},{id:'R14',hex:'#A3E7DC'},{id:'R15',hex:'#78CEE7'},{id:'R16',hex:'#3FCDCE'},{id:'R17',hex:'#4E8379'},{id:'R18',hex:'#7DCA9C'},{id:'R19',hex:'#C8E664'},{id:'R20',hex:'#E3CCBA'},{id:'R21',hex:'#A17140'},{id:'R22',hex:'#6B372C'},{id:'R23',hex:'#F6BB6F'},{id:'R24',hex:'#F3C6C0'},{id:'R25',hex:'#C76A62'},{id:'R26',hex:'#D093BC'},{id:'R27',hex:'#E58EAE'},{id:'R28',hex:'#9F85CF'},
        // T系列 (透明)
        {id:'T1',hex:'#FCFDFF'},
        // Y系列 (夜光)
        {id:'Y1',hex:'#FF6FB7'},{id:'Y2',hex:'#FDB583'},{id:'Y3',hex:'#D8FCA4'},{id:'Y4',hex:'#91DAFB'},{id:'Y5',hex:'#E987EA'},{id:'Y6',hex:'#F7D4B8'},{id:'Y7',hex:'#F1FA7D'},{id:'Y8',hex:'#5EE88C'},{id:'Y9',hex:'#F8F5FE'},
        // ZG系列 (光变)
        {id:'ZG1',hex:'#DAABB3'},{id:'ZG2',hex:'#D6AA87'},{id:'ZG3',hex:'#C1BD8D'},{id:'ZG4',hex:'#96B69F'},{id:'ZG5',hex:'#849DC6'},{id:'ZG6',hex:'#94BFE2'},{id:'ZG7',hex:'#E2A9D2'},{id:'ZG8',hex:'#AB91C0'}
    ];

    let data = JSON.parse(localStorage.getItem('bead_v_sort')) || MARD_DB.map(i => ({...i, w: 0, totalUsed: 0, logs: [], monitor: true}));
    
    // 同步新色号：检查 MARD_DB 中是否有新色号未在 data 中
    MARD_DB.forEach(dbItem => {
        let existing = data.find(d => d.id === dbItem.id);
        if (!existing) {
            data.push({...dbItem, w: 0, totalUsed: 0, logs: [], monitor: true});
        } else {
            // 修复：强制更新色值，解决旧数据颜色错误问题
            if(dbItem.hex) existing.hex = dbItem.hex;
            // 确保旧数据也有 monitor 字段
            if(existing.monitor === undefined) existing.monitor = true;
        }
    });

    let threshold = parseFloat(localStorage.getItem('bead_threshold')) || 5;
    // document.getElementById('threshold').value = threshold; 
    let sel = new Set();
    let selectedSeries = new Set(); // New series filter
    let currentEditId = null;
    let currentModelEditMode = 'add'; // 'add' or 'rename'
    let currentModelOldName = '';
    let currentModelToDelete = null;
    let currentRevertPlanId = null;
    let currentDeletePlanId = null;
    let currentMoveOutPlanId = null;
    let pendingMergePlans = null; // Store plans to be merged while waiting for name input
    let beadSortField = 'id';
    let beadSortOrder = 'asc';

    function setBeadSort(field) {
        if (beadSortField === field) {
            beadSortOrder = beadSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            beadSortField = field;
            // Default sort direction: numbers desc, text asc
            if (field === 'stock' || field === 'used') {
                beadSortOrder = 'desc';
            } else {
                beadSortOrder = 'asc';
            }
        }
        render();
    }

    function formatTime(now) {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        return `${y}/${m}/${d} ${h}:${min}:${s}`;
    }



    function createRow(item) {
        const isMonitored = item.monitor !== false;
        const isLow = isMonitored && (item.w < threshold);
        const grainCount = Math.round(item.w * 100);
        
        // 计算总补货
        let totalAdded = 0;
        if (item.totalAdded !== undefined) {
             totalAdded = item.totalAdded;
        } else {
            // 兼容逻辑：从 logs 计算并初始化
            if(item.logs) {
                 item.logs.forEach(log => {
                     if(log.type === 'add') totalAdded += (log.val || 0);
                 });
            }
            totalAdded = parseFloat(totalAdded.toFixed(2));
            // 初始化字段以便后续累加
            item.totalAdded = totalAdded; 
        }
        
        // 计算总消耗
        let totalUsed = 0;
        if (item.totalUsed !== undefined) {
             totalUsed = item.totalUsed;
        } else {
             // 兼容逻辑：从 logs 计算并初始化
             if(item.logs) {
                 item.logs.forEach(log => {
                     if(log.type !== 'add') {
                         const count = log.c || log.val || 0;
                         const g = parseFloat((count / 100).toFixed(2));
                         totalUsed += g;
                     }
                 });
             }
             totalUsed = parseFloat(totalUsed.toFixed(2));
             item.totalUsed = totalUsed; 
        }
        
        const monitorIcon = !isMonitored ? '<span style="font-size:12px; margin-left:2px; opacity:0.5;">🔕</span>' : '';
        const lowStyle = isLow ? 'color:#ff4d4f;' : 'color:#8c8c8c;';

        const row = document.createElement('div');
        row.className = `bead-card ${sel.has(item.id) ? 'selected' : ''}`;
        


        row.onclick = () => {
            if (sel.size > 0) {
                toggleSelect(item.id);
            }
        };
        
        row.innerHTML = `
            <div class="card-header">
                <div class="card-check"></div>
            </div>
            
            <div class="card-color-block" style="background:${item.hex};" onclick="if(sel.size===0) { event.stopPropagation(); manualEdit('${item.id}'); }"></div>

            <div class="card-info-section" style="padding: 0 2px;">
                 <!-- Color Code Line & Detail Icon -->
                 <div class="card-id-line" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px;">
                     <span style="font-weight: bold; font-size: 14px; color: #333;">${item.id} ${monitorIcon}</span>
                     <button onclick="event.stopPropagation(); openHistory('${item.id}')" style="background:none; border:none; padding:2px; color:#888; cursor:pointer; display:flex; align-items:center; line-height: 0;">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <circle cx="10" cy="14" r="3"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                     </button>
                 </div>

                 <!-- Weight & Grain -->
                 <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; white-space: nowrap;">
                     <div class="card-weight" style="${lowStyle}; font-size: 14px; font-weight: bold;">${item.w}<span class="card-unit" style="font-size:10px;">g</span></div>
                     <div class="card-grain" style="font-size: 10px; color: #999; margin-left: 4px;">≈${grainCount}粒</div>
                 </div>
            </div>
        `;
        return row;
    }

    function toggleSeries(s) {
        if (selectedSeries.has(s)) {
            selectedSeries.delete(s);
        } else {
            selectedSeries.add(s);
        }
        
        // Update UI
        const container = document.getElementById('series-filter-container');
        Array.from(container.children).forEach(chip => {
            if (selectedSeries.has(chip.innerText)) {
                chip.classList.add('selected');
            } else {
                chip.classList.remove('selected');
            }
        });
        
        render();
    }

    function toggleFilterVisibility() {
        const seriesContainer = document.getElementById('series-filter-container');
        const summaryBar = document.getElementById('bead-summary-bar');
        const btn = document.getElementById('btn-toggle-filter');
        
        // Toggle based on current state (assuming both sync, or base on summaryBar)
        if (summaryBar.style.display === 'none') {
            seriesContainer.style.display = 'flex';
            summaryBar.style.display = 'block';
            btn.style.background = '#e6f7ff';
            btn.style.borderColor = '#91d5ff';
        } else {
            seriesContainer.style.display = 'none';
            summaryBar.style.display = 'none';
            btn.style.background = '#fff';
            btn.style.borderColor = '#ddd';
        }
    }

    function render() {
        const q = document.getElementById('search').value.toUpperCase();
        
        // 获取当前系列筛选状态
        let seriesMode = document.getElementById('seriesFilter').value;
        // 保存到 localStorage
        localStorage.setItem('bead_series_filter', seriesMode);

        // Update series chips visibility
        const extraSeries = ['P', 'Q', 'R', 'T', 'Y', 'ZG'];
        const container = document.getElementById('series-filter-container');
        if (container) {
            Array.from(container.children).forEach(chip => {
                const s = chip.innerText;
                if (extraSeries.includes(s)) {
                    // Hide special series if mode is 221
                    if (seriesMode === '221') {
                        chip.style.display = 'none';
                        // If hidden chip was selected, deselect it
                        if (selectedSeries.has(s)) {
                            selectedSeries.delete(s);
                            chip.classList.remove('selected');
                        }
                    } else {
                        chip.style.display = ''; // Restore visibility
                    }
                }
            });
        }

        const grid = document.getElementById('grid');
        grid.innerHTML = '';
        
        // Update Selection Mode Class
        if (sel.size > 0) {
            if(grid.parentElement) grid.parentElement.classList.add('selection-mode');
        } else {
            if(grid.parentElement) grid.parentElement.classList.remove('selection-mode');
        }
        
        // 1. Filter by Series
        let displayData = data.filter(item => {
            const match = item.id.match(/^[A-Z]+/);
            const series = match ? match[0] : '';

            // New: Checkbox filter优先
            if (selectedSeries.size > 0) {
                return selectedSeries.has(series);
            }

            if (seriesMode === 'all') return true;
            // Mard 221 模式下排除 P, Q, R, T, Y, ZG 系列
            return !extraSeries.includes(series);
        });

        // 2. Pre-calculate Stats & Contextual Summary
        let sumStock = 0;
        let sumUsed = 0;
        let sumLow = 0;

        displayData.forEach(item => {
            // Ensure totalUsed is calculated (logic from createRow)
            if (item.totalUsed === undefined) {
                 let tu = 0;
                 if(item.logs) {
                     item.logs.forEach(log => {
                         if(log.type !== 'add') {
                             const count = log.c || log.val || 0;
                             const g = parseFloat((count / 100).toFixed(2));
                             tu += g;
                         }
                     });
                 }
                 item.totalUsed = parseFloat(tu.toFixed(2));
            }

            sumStock += item.w;
            sumUsed += (item.totalUsed || 0);

            // Low Stock Check (monitor enabled and below threshold)
            if (item.monitor !== false && item.w < threshold) {
                sumLow++;
            }
        });

        // Update Summary Bar
        const elSumTotal = document.getElementById('sum-total-stock');
        const elSumUsed = document.getElementById('sum-total-used');
        const elSumLow = document.getElementById('sum-low-count');
        if(elSumTotal) elSumTotal.innerText = sumStock.toFixed(0);
        if(elSumUsed) elSumUsed.innerText = sumUsed.toFixed(0);
        if(elSumLow) elSumLow.innerText = sumLow;

        // 3. Calculate Badge Low Count (Dropdown only, ignore Chips for consistency with badge behavior)
        let badgeLowCount = 0;
        data.forEach(d => {
             if (d.monitor === false || d.w >= threshold) return;
             if (seriesMode === 'all') {
                 badgeLowCount++;
                 return;
             }
             const match = d.id.match(/^[A-Z]+/);
             const series = match ? match[0] : '';
             if (!extraSeries.includes(series)) {
                 badgeLowCount++;
             }
        });
        const elCountLow = document.getElementById('count-low');
        if(elCountLow) elCountLow.innerText = badgeLowCount;

        // 4. Update Sort Buttons UI
        const sortMap = {
            'id': 'btn-sort-id',
            'stock': 'btn-sort-stock',
            'used': 'btn-sort-used'
        };
        
        Object.keys(sortMap).forEach(key => {
            const btn = document.getElementById(sortMap[key]);
            if(btn) {
                if (key === beadSortField) {
                     btn.classList.add('active');
                     const arrow = btn.querySelector('.sort-arrow');
                     if(arrow) arrow.innerText = beadSortOrder === 'asc' ? '↑' : '↓';
                } else {
                     btn.classList.remove('active');
                     const arrow = btn.querySelector('.sort-arrow');
                     if(arrow) arrow.innerText = '';
                }
            }
        });

        // 5. Sort Data
        displayData.sort((a, b) => {
            let valA, valB;
            
            if (beadSortField === 'stock') {
                valA = a.w; valB = b.w;
                return beadSortOrder === 'asc' ? valA - valB : valB - valA;
            } else if (beadSortField === 'used') {
                valA = a.totalUsed || 0; valB = b.totalUsed || 0;
                return beadSortOrder === 'asc' ? valA - valB : valB - valA;
            } else {
                // ID
                valA = a.id; valB = b.id;
                const cmp = valA.localeCompare(valB, undefined, {numeric: true, sensitivity: 'base'});
                return beadSortOrder === 'asc' ? cmp : -cmp;
            }
        });

        // 6. Render Grid (Apply Search Filter)
        displayData.forEach(item => {
            if (item.id.includes(q)) {
                grid.appendChild(createRow(item));
            }
        });
        
        save();
    }



    function toggleSelect(id) {
        sel.has(id) ? sel.delete(id) : sel.add(id);
        updateFooter();
        render();
    }
    
    function cancelSelection() {
        sel.clear();
        updateFooter();
        render();
    }

    function batchSetMonitor(enable) {
        if (sel.size === 0) return;
        sel.forEach(id => {
            const item = data.find(d => d.id === id);
            if(item) item.monitor = enable;
        });
        save();
        cancelSelection();
        showToast(enable ? "已开启选中色号的阈值提醒" : "已关闭选中色号的阈值提醒");
    }
    
    function updateFooter() {
        document.getElementById('footer').style.display = sel.size > 0 ? 'flex' : 'none';
        document.getElementById('selNum').innerText = sel.size;
    }

    function quickAdd(id) {
        const item = data.find(d => d.id === id);
        const addVal = 10;
        item.w = parseFloat((item.w + addVal).toFixed(2));
        // 维护总补货量
        item.totalAdded = parseFloat(((item.totalAdded || 0) + addVal).toFixed(2));
        
        // 记录补货日志
        const now = new Date();
        const dateStr = formatTime(now);
        if(!item.logs) item.logs = [];
        item.logs.push({ d: dateStr, type: 'add', val: addVal });
        if(item.logs.length > 20) item.logs.shift(); // 增加日志保留条数
        
        save(); // 增加保存
        render();
        showToast("库存已增加");
    }

    function manualEdit(id) {
        currentEditId = id;
        const item = data.find(d => d.id === id);
        document.getElementById('editWeightModalTitle').innerText = `修改库存重量 ${id}`;
        const input = document.getElementById('editWeightInput');
        input.value = item.w;
        showModal('editWeightModal');
        setTimeout(() => input.focus(), 50);
        
        // 绑定回车事件
        input.onkeydown = function(e) {
            if(e.key === 'Enter') submitEditWeight();
        }
    }

    function openRestockModal() {
        if(!currentEditId) return;
        document.getElementById('restockTitle').innerText = `正在为色号 [${currentEditId}] 补货`;
        document.getElementById('restockInput').value = '';
        showModal('restockModal');
        setTimeout(() => document.getElementById('restockInput').focus(), 50);
        
        document.getElementById('restockInput').onkeydown = function(e) {
            if(e.key === 'Enter') submitRestock();
        }
    }

    function submitRestock() {
        const val = parseFloat(document.getElementById('restockInput').value);
        if(!currentEditId || isNaN(val) || val <= 0) {
            alert("请输入有效的补货重量");
            return;
        }
        
        const item = data.find(d => d.id === currentEditId);
        item.w = parseFloat((item.w + val).toFixed(2));
        // 维护总补货量
        item.totalAdded = parseFloat(((item.totalAdded || 0) + val).toFixed(2));
        
        // 记录日志
        const now = new Date();
        const dateStr = formatTime(now);
        if(!item.logs) item.logs = [];
        item.logs.push({ d: dateStr, type: 'add', val: val });
        if(item.logs.length > 20) item.logs.shift();
        
        save();
        render();
        closeAllModals();
        showToast(`已成功补货 ${val}g`);
    }

    function openHistory(id) {
        const item = data.find(d => d.id === id);
        if(!item) return; // 容错处理

        // 1. 设置标题和概览数据
        document.getElementById('historyTitle').innerHTML = `色号 ${id} 明细`;
        document.getElementById('hist-stock').innerText = (item.w || 0) + 'g';
        document.getElementById('hist-used').innerText = (item.totalUsed || 0) + 'g';
        
        // 计算总补充：优先使用持久化字段
        let totalAdded = 0;
        if (item.totalAdded !== undefined) {
            totalAdded = item.totalAdded;
        } else {
            if(item.logs) {
                item.logs.forEach(log => {
                    if(log.type === 'add') {
                        totalAdded += (log.val || 0);
                    }
                });
            }
        }
        document.getElementById('hist-added').innerText = parseFloat(totalAdded.toFixed(2)) + 'g';

        // 计算总消耗
        let totalUsed = 0;
        if (item.totalUsed !== undefined) {
             totalUsed = item.totalUsed;
        } else {
             if(item.logs) {
                 item.logs.forEach(log => {
                     if(log.type !== 'add') {
                         const count = log.c || log.val || 0;
                         const g = parseFloat((count / 100).toFixed(2));
                         totalUsed += g;
                     }
                 });
             }
        }
        document.getElementById('hist-used').innerText = parseFloat(totalUsed.toFixed(2)) + 'g';

        // 2. 渲染记录表格
        const tbody = document.getElementById('historyList');
        tbody.innerHTML = '';
        
        if (item.logs && item.logs.length > 0) {
            // 给日志加上原始索引，方便删除
            const logsWithIdx = item.logs.map((log, idx) => ({...log, idx}));
            
            // 倒序显示
            logsWithIdx.reverse().forEach(log => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f0f0f0';
                
                // --- 时间列 ---
                const tdTime = document.createElement('td');
                tdTime.style.padding = '6px 2px';
                tdTime.style.color = '#666';
                tdTime.style.fontSize = '11px';
                tdTime.style.whiteSpace = 'nowrap';
                
                let timeStr = log.d;
                if (!timeStr && log.date) {
                    try {
                        const dateObj = new Date(log.date);
                        timeStr = formatTime(dateObj);
                    } catch(e) {
                        timeStr = log.date;
                    }
                }
                
                if (timeStr && timeStr.indexOf(' ') > -1) {
                    const parts = timeStr.split(' ');
                    const datePart = parts[0];
                    const timePart = parts.slice(1).join(' ');
                    tdTime.innerHTML = `<div style="line-height:1.2">${datePart}<br><span style="font-size:10px; color:#999;">${timePart}</span></div>`;
                } else {
                    tdTime.innerText = timeStr || '-';
                }
                tr.appendChild(tdTime);

                // --- 图纸名称列 ---
                const tdDrawing = document.createElement('td');
                tdDrawing.style.padding = '6px 2px';
                tdDrawing.style.textAlign = 'left';
                tdDrawing.style.color = '#666';
                tdDrawing.style.fontSize = '12px';
                tdDrawing.style.whiteSpace = 'nowrap';
                tdDrawing.innerText = log.drawingName || '';
                tr.appendChild(tdDrawing);
                
                // --- 操作类型列 ---
                const tdType = document.createElement('td');
                tdType.style.padding = '6px 2px';
                tdType.style.textAlign = 'center';
                tdType.style.whiteSpace = 'nowrap';
                
                let typeText = '';
                let typeColor = '#333';
                
                if (log.type === 'add') {
                    typeText = '补货';
                    typeColor = '#52c41a'; // 绿色
                } else {
                    typeText = '消耗';
                    typeColor = '#ff4d4f'; // 红色
                }
                
                tdType.innerHTML = `<span style="background:${typeColor}15; color:${typeColor}; padding:2px 6px; border-radius:4px; font-size:11px;">${typeText}</span>`;
                tr.appendChild(tdType);
                
                // --- 重量/粒数及删除列 ---
                const tdVal = document.createElement('td');
                tdVal.style.padding = '6px 2px';
                tdVal.style.textAlign = 'left';
                tdVal.style.whiteSpace = 'nowrap';
                
                let valHtml = '';
                if (log.type === 'add') {
                    valHtml = `<div style="line-height:1.2"><span style="color:#333;">+${log.val}g</span></div>`;
                } else {
                    const count = log.c || log.val || 0;
                    const weight = (count / 100).toFixed(2);
                    // 第一行显示重量，第二行显示粒数
                    valHtml = `<div style="line-height:1.2"><span style="color:#333;">-${weight}g</span><br><span style="font-size:10px; color:#999;">(≈${count}粒)</span></div>`;
                }
                
                // 删除按钮
                const delBtn = `<button onclick="deleteLog('${id}', ${log.idx})" style="margin-left:8px; border:none; background:none; color:#999; cursor:pointer; font-size:16px; padding:0;">×</button>`;
                
                tdVal.innerHTML = `<div style="display:flex; align-items:center; justify-content:flex-start;"><div style="white-space:nowrap;">${valHtml}</div>${delBtn}</div>`;
                tr.appendChild(tdVal);
                
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="padding:20px; text-align:center; color:#999;">暂无记录</td>';
            tbody.appendChild(tr);
        }
        
        showModal('historyModal');
    }

    function deleteLog(id, logIdx) {
        // One-click delete (no confirm)
        
        const item = data.find(d => d.id === id);
        if(!item || !item.logs || !item.logs[logIdx]) return;
        
        const log = item.logs[logIdx];
        
        if (log.type === 'add') {
            // 回滚补货：减少库存
            item.w = Math.max(0, parseFloat((item.w - log.val).toFixed(2)));
            // 回滚总补货
            item.totalAdded = Math.max(0, parseFloat(((item.totalAdded || 0) - log.val).toFixed(2)));
        } else {
            // 回滚消耗：增加库存，减少累计消耗
            const count = log.c || log.val || 0;
            const g = parseFloat((count / 100).toFixed(2));
            item.w = parseFloat((item.w + g).toFixed(2));
            item.totalUsed = Math.max(0, parseFloat((item.totalUsed - g).toFixed(2)));
        }
        
        // 删除记录
        item.logs.splice(logIdx, 1);
        
        save();
        render();
        // 自动关闭弹窗
        closeAllModals();
        showToast("删除成功，库存已回滚");
    }

    function submitEditWeight() {
        if(!currentEditId) return;
        const input = document.getElementById('editWeightInput');
        const val = parseFloat(input.value);
        
        // 保持原有逻辑：输入无效数字则视为0
        const finalVal = (!isNaN(val) && val >= 0) ? val : 0;
        
        const item = data.find(d => d.id === currentEditId);
        if(item) {
            const oldVal = item.w;
            const diff = finalVal - oldVal;
            
            // 更新库存
            item.w = parseFloat(finalVal.toFixed(2));
            
            // 自动记录日志 (忽略极小差异)
            if (Math.abs(diff) > 0.001) {
                const now = new Date();
                const dateStr = formatTime(now);
                if(!item.logs) item.logs = [];
                
                if (diff > 0) {
                    const addedVal = parseFloat(diff.toFixed(2));
                    // 增加库存 -> 视为补货
                    item.logs.push({ d: dateStr, type: 'add', val: addedVal, isManual: true });
                    // 维护总补货量
                    item.totalAdded = parseFloat(((item.totalAdded || 0) + addedVal).toFixed(2));
                } else {
                    // 减少库存 -> 视为消耗
                    const loss = -diff;
                    // 更新累计消耗
                    item.totalUsed = parseFloat(((item.totalUsed || 0) + loss).toFixed(2));
                    // 记录为消耗 (折算为粒数，假设 1g = 100 粒)
                    item.logs.push({ d: dateStr, c: Math.round(loss * 100), isManual: true });
                }
                
                if(item.logs.length > 20) item.logs.shift();
            }
            
            render();
        }
        
        closeAllModals();
        currentEditId = null;
        input.onkeydown = null;
        showToast("库存修改成功");
    }

    function openConsumeModal() {
        const listDiv = document.getElementById('modalList');
        listDiv.innerHTML = '';
        
        if (sel.size === 0) {
            listDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:12px;">未选择任何色号</div>';
            showModal('consumeModal');
            return;
        }

        sel.forEach(id => {
            const item = data.find(d => d.id === id);
            const currentStockGrains = Math.round(item.w * 100); // 当前库存粒数
            
            const row = document.createElement('div');
            row.className = 'modal-row';
            // 使用自定义样式覆盖默认 modal-row
            row.style.cssText = 'display:flex; flex-direction:column; padding: 12px; border-bottom: 1px solid #f0f0f0; background:white; align-items: stretch;';
            
            row.innerHTML = `
                <div style="display:flex; align-items:center; justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap: 12px;">
                        <div class="swatch" style="width:28px; height:28px; background:${item.hex}; border-radius:50%; border:1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"></div>
                        <div style="display:flex; flex-direction:column;">
                            <b style="font-size:16px; color:#333;">${id}</b>
                            <span style="font-size:11px; color:#999;">库存: ${currentStockGrains}粒</span>
                        </div>
                    </div>
                    <div style="position:relative;">
                        <input type="number" class="consume-input" data-id="${id}" data-stock="${currentStockGrains}" placeholder="0" oninput="checkConsumeLimit(this)" 
                               style="width: 70px; padding: 8px 5px; border: 1px solid #e0e0e0; border-radius: 8px; text-align: center; font-size: 16px; font-weight:bold; color:#333; outline:none; background:#f9fafb; transition: all 0.2s;">
                    </div>
                </div>
                <div class="limit-warn" id="warn-${id}" style="width:100%; color:#ff4d4f; font-size:11px; margin-top:8px; display:none; text-align:right; background:#fff1f0; padding:4px 8px; border-radius:4px;">
                     ⚠️ 消耗量超过库存 (${currentStockGrains})
                </div>
            `;
            listDiv.appendChild(row);
        });
        
        // 去除最后一行边框
        if(listDiv.lastChild) listDiv.lastChild.style.borderBottom = 'none';
        
        showModal('consumeModal');
        
        // 自动聚焦第一个输入框
        setTimeout(() => {
            const firstInput = listDiv.querySelector('input');
            if(firstInput) firstInput.focus();
        }, 100);
    }

    function checkConsumeLimit(input) {
        const val = parseFloat(input.value) || 0;
        const stock = parseFloat(input.getAttribute('data-stock'));
        const id = input.getAttribute('data-id');
        const warnEl = document.getElementById(`warn-${id}`);
        
        if (val > stock) {
            warnEl.style.display = 'block';
        } else {
            warnEl.style.display = 'none';
        }
    }

    function submitConsume() {
        const inputs = document.querySelectorAll('.consume-input');
        const now = new Date();
        const dateStr = formatTime(now);
        
        inputs.forEach(input => {
            const id = input.getAttribute('data-id');
            const count = parseFloat(input.value) || 0;
            if(count > 0) {
                const item = data.find(d => d.id === id);
                const g = count / 100;
                item.w = Math.max(0, parseFloat((item.w - g).toFixed(2)));
                item.totalUsed = parseFloat(((item.totalUsed || 0) + g).toFixed(2));
                if(!item.logs) item.logs = [];
                item.logs.push({ d: dateStr, c: count });
                if(item.logs.length > 10) item.logs.shift();
            }
        });
        closeAllModals();
        sel.clear();
        document.getElementById('footer').style.display = 'none';
        save();
        render();
        showToast("库存扣除成功");
    }

    // --- Generic Confirmation Modal ---
    function showConfirmModal(title, message, onConfirm) {
        document.getElementById('customConfirmTitle').innerText = title;
        document.getElementById('customConfirmMessage').innerText = message;
        
        const modal = document.getElementById('customConfirmModal');
        // Ensure it is on top of other modals
        modal.style.zIndex = '1050'; 
        
        const okBtn = document.getElementById('customConfirmOkBtn');
        const cancelBtn = document.getElementById('customConfirmCancelBtn');

        // Reset onclick to avoid multiple bindings
        okBtn.onclick = () => {
            if (onConfirm) onConfirm();
            closeAllModals();
        };
        
        // Handle Cancel: Close only this modal if others are open
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            // Check if any other modal is visible
            const others = Array.from(document.querySelectorAll('.modal')).some(m => m.style.display !== 'none' && m.id !== 'customConfirmModal');
            if (!others) {
                document.getElementById('mask').style.display = 'none';
            }
        };
        
        showModal('customConfirmModal');
    }

    function showModal(id) {
        // Check if any other modal is already open
        const openModals = Array.from(document.querySelectorAll('.modal')).filter(el => el.style.display === 'block' && el.id !== id);
        
        if (openModals.length > 0) {
            // Nested modal
            const mask2 = document.getElementById('mask2');
            if (mask2) {
                mask2.style.display = 'block';
                // Enforce blur style
                mask2.style.backdropFilter = 'blur(8px)';
                mask2.style.webkitBackdropFilter = 'blur(8px)';
            }
            document.getElementById(id).style.zIndex = '1020';
        } else {
            // First modal
            const mask = document.getElementById('mask');
            mask.style.display = 'block';
            // Enforce blur style
            mask.style.backdropFilter = 'blur(8px)';
            mask.style.webkitBackdropFilter = 'blur(8px)';
            document.getElementById(id).style.zIndex = '1010';
        }
        document.getElementById(id).style.display = 'block';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(el => {
            el.style.display = 'none';
            // Reset z-index
            el.style.zIndex = ''; 
        });
        document.getElementById('mask').style.display = 'none';
        const mask2 = document.getElementById('mask2');
        if (mask2) mask2.style.display = 'none';
    }

    // 兼容旧函数调用，防止遗漏
    function closeModal() { closeAllModals(); }

    function save() { localStorage.setItem('bead_v_sort', JSON.stringify(data)); }

    // --- 数据管理功能 ---
    function openDataModal(tab) {
        showModal('dataModal');
        switchDataTab(tab);
        // Clean up previous inputs
        if(tab !== 'backup') {
            document.getElementById('restoreInput').value = '';
        }
    }

    function switchDataTab(tab) {
        // Reset styles
        ['tabBackup', 'tabRestore'].forEach(id => {
            const el = document.getElementById(id);
            el.style.fontWeight = 'normal';
            el.style.color = '#666';
            el.style.borderBottom = '2px solid transparent';
            el.classList.remove('active');
        });

        // Set active style
        const activeId = tab === 'backup' ? 'tabBackup' : 'tabRestore';
        const activeEl = document.getElementById(activeId);
        activeEl.style.fontWeight = 'bold';
        activeEl.style.color = '#4a90e2';
        activeEl.style.borderBottom = '2px solid #4a90e2';
        activeEl.classList.add('active');

        document.getElementById('viewBackup').style.display = tab==='backup' ? 'block' : 'none';
        document.getElementById('viewRestore').style.display = tab==='restore' ? 'block' : 'none';

        // Toggle footer buttons
        document.getElementById('btnBackupAction').style.display = tab==='backup' ? 'flex' : 'none';
        document.getElementById('btnRestoreAction').style.display = tab==='restore' ? 'flex' : 'none';
    }

    function execRestore() {
        let content = document.getElementById('restoreInput').value;
        if (!content) return;
        
        showModal('importConfirmModal');
    }

    function confirmImport() {
        let content = document.getElementById('restoreInput').value;
        if (!content) return;

        // 移除可能的 BOM
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        content = content.trim();

        let jsonStr = content;

        // 检测是否为 CSV 单元格封装格式 (以引号开头和结尾)
        if (content.startsWith('"') && content.endsWith('"')) {
            // 移除首尾引号
            let inner = content.substring(1, content.length - 1);
            // 还原转义的引号 ("" -> ")
            jsonStr = inner.replace(/""/g, '"');
        }

        try {
            const backupData = JSON.parse(jsonStr);
            let restoreItems = [];
            let newThreshold = null;
            let newPlans = null;
            let newAiData = null;

            // 兼容直接的数组格式 (旧版 JSON) 或新的对象格式
            if (Array.isArray(backupData)) {
                restoreItems = backupData;
            } else if (backupData.items && Array.isArray(backupData.items)) {
                restoreItems = backupData.items;
                if (backupData.threshold !== undefined) newThreshold = backupData.threshold;
                if (backupData.plans) newPlans = backupData.plans;
                if (backupData.aiData) newAiData = backupData.aiData;
            } else if (backupData.data && Array.isArray(backupData.data)) {
                 // 兼容之前尝试过的 JSON 结构 { data: [...] }
                 restoreItems = backupData.data;
                 if (backupData.config && backupData.config.threshold) newThreshold = backupData.config.threshold;
            } else {
                throw new Error("无效的数据格式");
            }

            // 构建快速查找表
            const backupMap = new Map(restoreItems.map(i => [i.id, i]));
            let restoreCount = 0;

            // 更新现有数据
            data.forEach(item => {
                if (backupMap.has(item.id)) {
                    const backupItem = backupMap.get(item.id);
                    item.w = backupItem.w !== undefined ? backupItem.w : 0;
                    item.monitor = backupItem.monitor !== undefined ? backupItem.monitor : true;
                    item.logs = backupItem.logs || [];
                    item.totalAdded = backupItem.totalAdded || 0;
                    item.totalUsed = backupItem.totalUsed || 0;
                    restoreCount++;
                } else {
                    // 如果备份中没有该色号，重置为初始状态
                    item.w = 0;
                    item.monitor = true;
                    item.logs = [];
                    item.totalAdded = 0;
                    item.totalUsed = 0;
                }
            });

            // 恢复阈值配置
            if (newThreshold !== null) {
                threshold = parseFloat(newThreshold);
                localStorage.setItem('bead_threshold', threshold);
                const thresholdInput = document.getElementById('threshold');
                if(thresholdInput) thresholdInput.value = threshold;
            }

            // 恢复计划数据
            if (newPlans) {
                localStorage.setItem('bead_plans', JSON.stringify(newPlans));
            }

            // 恢复AI配置
            if (newAiData) {
                localStorage.setItem('ai_usage_data', JSON.stringify(newAiData));
            }

            save();
            render();
            if (typeof renderPlans === 'function') renderPlans();
            closeAllModals();
            
            let msg = `数据导入成功 (恢复 ${restoreCount} 个色号`;
            if(newPlans) msg += `，${newPlans.length} 个计划`;
            msg += ')';
            showToast(msg);

        } catch (e) {
            console.error(e);
            alert("数据解析失败，请检查文件格式。\n错误信息: " + e.message);
        }
    }

    async function downloadBackupFile() {
        // 构建完整的备份对象
        const backupObj = {
            version: "2.1",
            timestamp: new Date().toISOString(),
            threshold: threshold,
            items: data,
            plans: JSON.parse(localStorage.getItem('bead_plans') || '[]'),
            // Use ModelUsageManager.getData() and perform cleanup to ensure we don't export ghost data
            aiData: (() => {
                const d = ModelUsageManager.getData();
                if (d && d.modelOrder && d.keys) {
                    const activeModels = new Set(d.modelOrder);
                    d.keys.forEach(k => {
                        if (k.usage) {
                            Object.keys(k.usage).forEach(m => {
                                if (!activeModels.has(m)) delete k.usage[m];
                            });
                        }
                    });
                }
                return d;
            })()
        };

        const jsonStr = JSON.stringify(backupObj, null, 2);
        const fileName = `Mard_Inventory_Backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.txt`;
        
        // 尝试使用 HTML5+ API 保存到指定私有目录 (Android/data/...)
        if (window.plus && window.plus.io) {
            const specificPath = "file:///storage/emulated/0/Android/data/plus.H5F9023DE/downloads/";
            
            // Helper to write file
            const writeToFile = (entry) => {
                entry.getFile(fileName, {create: true, exclusive: false}, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwrite = function() {
                            showToast(`备份已导出！`);
                            alert(`备份成功！\n\n文件路径:\n${specificPath}${fileName}\n\n请使用文件管理器查看。`);
                        };
                        writer.onerror = function(e) {
                             console.error("写入失败", e);
                             alert("写入文件失败: " + e.message + "\n尝试使用普通下载...");
                             triggerWebDownload();
                        };
                        writer.write(jsonStr);
                    }, function(e){
                        console.error("创建写入器失败", e);
                        triggerWebDownload();
                    });
                }, function(e){
                    console.error("创建文件失败", e);
                    triggerWebDownload();
                });
            };

            // Try resolving the specific path directly
            plus.io.resolveLocalFileSystemURL(specificPath, function(entry) {
                writeToFile(entry);
            }, function(e) {
                console.log("无法直接访问指定目录，尝试创建或使用默认下载目录", e);
                
                // Fallback: try standard downloads if specific path fails (though user insisted on specific path, 
                // if it doesn't exist we can't write to it easily without resolving root first. 
                // Let's try to just use triggerWebDownload as fallback if the specific path is invalid on this device)
                triggerWebDownload();
            });
            return;
        }
        
        triggerWebDownload();

        function triggerWebDownload() {
            try {
                // 1. Create Blob
                const blob = new Blob([jsonStr], {type: "text/plain;charset=utf-8"});
                
                // 2. Create URL
                const url = URL.createObjectURL(blob);
                
                // 3. Create Link
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                
                // 4. Trigger Click
                document.body.appendChild(a);
                a.click();
                
                // 5. Cleanup
                setTimeout(() => { 
                    document.body.removeChild(a); 
                    URL.revokeObjectURL(url); 
                }, 2000);
                
                // 6. User Feedback
                if (window.plus) {
                    showToast("已请求系统下载，请查看通知栏");
                } else {
                    showToast("已开始下载");
                }
            } catch(e) {
                console.error("Web download failed:", e);
                alert("导出失败，请截图保存以下数据:\n" + e.message);
            }
        }
    }

    function loadBackupFile(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                // Store content in hidden textarea for execRestore logic
                document.getElementById('restoreInput').value = e.target.result;
                // Immediately ask to restore
                execRestore();
            };
            reader.readAsText(file);
        }
        input.value = '';
    }

    // --- 批量初始录入功能 ---
    function openBatchInput() {
        document.getElementById('batchInputText').value = '';
        showModal('batchInputModal');
    }

    function submitBatchInput() {
        const text = document.getElementById('batchInputText').value;
        const regex = /([A-Z]+[0-9]+)[^0-9\.]*(\d+(\.\d+)?)/gi;
        let match;
        let count = 0;
        while ((match = regex.exec(text)) !== null) {
            const id = match[1].toUpperCase();
            const w = parseFloat(match[2]);
            const item = data.find(d => d.id === id);
            if(item) {
                item.w = w;
                count++;
            }
        }
        save();
        render();
        closeAllModals();
        showToast(`已批量更新 ${count} 个色号的库存`);
    }

    function copyLowStockText() {
        const el = document.getElementById('lowStockText');
        el.select();
        navigator.clipboard.writeText(el.value).then(() => showToast("已复制到剪贴板"));
    }

    let selectedIgnoredSeries = new Set();

    let currentIgnoredTab = 'disabled';
    let batchIgnoredSelection = new Set();
    let isIgnoredFilterVisible = false;

    function openIgnoredModal(reset = false) {
        if (reset) {
             selectedIgnoredSeries.clear();
             currentIgnoredTab = 'disabled';
             isIgnoredFilterVisible = false;
        }
        batchIgnoredSelection.clear();
        renderIgnoredUI();
        showModal('ignoredModal');
        document.getElementById('ignoredModal').style.display = 'flex';
    }

    function switchIgnoredTab(tab) {
        if(currentIgnoredTab === tab) return;
        currentIgnoredTab = tab;
        selectedIgnoredSeries.clear();
        batchIgnoredSelection.clear();
        renderIgnoredUI();
    }

    function renderIgnoredUI() {
        const tabDisabled = document.getElementById('tab-ignored-disabled');
        const tabEnabled = document.getElementById('tab-ignored-enabled');
        if (currentIgnoredTab === 'disabled') {
            tabDisabled.className = 'ai-tab active';
            tabDisabled.style.color = '#e24a4a';
            tabDisabled.style.borderBottomColor = '#e24a4a';
            tabEnabled.className = 'ai-tab';
            tabEnabled.style.color = '#666';
            tabEnabled.style.borderBottomColor = 'transparent';
        } else {
            tabDisabled.className = 'ai-tab';
            tabDisabled.style.color = '#666';
            tabDisabled.style.borderBottomColor = 'transparent';
            tabEnabled.className = 'ai-tab active';
            tabEnabled.style.color = '#4a90e2';
            tabEnabled.style.borderBottomColor = '#4a90e2';
        }

        let list = data.filter(d => currentIgnoredTab === 'disabled' ? d.monitor === false : d.monitor !== false);

        renderIgnoredSeriesFilter(list);
        renderIgnoredList(list);

        const btnAction = document.getElementById('btn-ignored-batch-action');
        const count = batchIgnoredSelection.size;
        btnAction.disabled = count === 0;
        
        if (currentIgnoredTab === 'disabled') {
            btnAction.textContent = count > 0 ? `批量开启 (${count})` : '批量开启';
            btnAction.className = 'm-btn m-btn-primary';
            btnAction.style.borderColor = '';
            btnAction.style.color = '#fff';
        } else {
            btnAction.textContent = count > 0 ? `批量关闭 (${count})` : '批量关闭';
            btnAction.className = 'm-btn m-btn-ghost'; 
            btnAction.style.borderColor = '#ff4d4f';
            btnAction.style.color = '#ff4d4f';
        }
    }

    function renderIgnoredSeriesFilter(fullList) {
        const container = document.getElementById('ignoredSeriesFilter');
        const toggleBtn = document.getElementById('btn-toggle-ignored-filter');
        
        const seriesSet = new Set();
        fullList.forEach(item => {
            const match = item.id.match(/^[A-Z]+/);
            if (match) seriesSet.add(match[0]);
        });
        const seriesList = Array.from(seriesSet).sort();

        if (seriesList.length <= 1) {
             toggleBtn.style.display = 'none';
             container.style.display = 'none';
             return;
        }

        toggleBtn.style.display = 'flex';
        container.style.display = isIgnoredFilterVisible ? 'flex' : 'none';
        
        if (isIgnoredFilterVisible) {
            toggleBtn.style.background = '#e6f7ff';
            toggleBtn.style.borderColor = '#91d5ff';
            toggleBtn.style.color = '#1890ff';
        } else {
            toggleBtn.style.background = '#fff';
            toggleBtn.style.borderColor = '#ddd';
            toggleBtn.style.color = '#666';
        }

        container.innerHTML = '';
        seriesList.forEach(s => {
            const isSelected = selectedIgnoredSeries.has(s);
            const btn = document.createElement('div');
            btn.textContent = s;
            btn.style.cssText = `
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 13px;
                cursor: pointer;
                border: 1px solid ${isSelected ? '#4a90e2' : '#ddd'};
                background: ${isSelected ? '#4a90e2' : '#fff'};
                color: ${isSelected ? '#fff' : '#666'};
                transition: all 0.2s;
                user-select: none;
            `;
            btn.onclick = () => toggleIgnoredSeries(s);
            container.appendChild(btn);
        });
    }

    function toggleIgnoredFilterVisibility() {
        isIgnoredFilterVisible = !isIgnoredFilterVisible;
        renderIgnoredUI();
    }

    function toggleIgnoredSeries(s) {
        if (selectedIgnoredSeries.has(s)) {
            selectedIgnoredSeries.delete(s);
        } else {
            selectedIgnoredSeries.add(s);
        }
        renderIgnoredUI();
    }

    function renderIgnoredList(list) {
        if (selectedIgnoredSeries.size > 0) {
            list = list.filter(item => {
                const match = item.id.match(/^[A-Z]+/);
                return match && selectedIgnoredSeries.has(match[0]);
            });
        }

        const container = document.getElementById('ignoredList');
        const countSpan = document.getElementById('ignoredListCount');
        countSpan.textContent = `共 ${list.length} 个`;
        
        container.innerHTML = '';
        
        const selectAllCb = document.getElementById('ignoredSelectAll');
        const allSelected = list.length > 0 && list.every(item => batchIgnoredSelection.has(item.id));
        selectAllCb.checked = allSelected;

        if(list.length === 0) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:#999; font-size:13px;">暂无数据</div>';
        } else {
            list.forEach(item => {
                const isSelected = batchIgnoredSelection.has(item.id);
                const row = document.createElement('div');
                row.className = 'modal-row';
                row.style.cssText = `
                    display:flex; align-items:center; padding:10px; border-bottom:1px solid #f9f9f9; gap: 10px; cursor: pointer;
                    background: ${isSelected ? '#f0f7ff' : '#fff'};
                `;
                row.onclick = () => toggleIgnoredBatchItem(item.id);

                row.innerHTML = `
                    <div style="flex-shrink:0;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events:none;"> 
                    </div>
                    <div class="swatch" style="width:24px; height:24px; background:${item.hex}; border-radius:6px; border:1px solid #eee; flex-shrink: 0;"></div>
                    <span style="font-weight:bold; font-size:15px; flex:1;">${item.id}</span>
                `;
                container.appendChild(row);
            });
        }
    }

    function toggleIgnoredBatchItem(id) {
        if (batchIgnoredSelection.has(id)) {
            batchIgnoredSelection.delete(id);
        } else {
            batchIgnoredSelection.add(id);
        }
        renderIgnoredUI();
    }

    function toggleAllIgnoredBatchSelection() {
        const selectAllCb = document.getElementById('ignoredSelectAll');
        let list = data.filter(d => currentIgnoredTab === 'disabled' ? d.monitor === false : d.monitor !== false);
        if (selectedIgnoredSeries.size > 0) {
            list = list.filter(item => {
                const match = item.id.match(/^[A-Z]+/);
                return match && selectedIgnoredSeries.has(match[0]);
            });
        }

        if (selectAllCb.checked) {
            list.forEach(item => batchIgnoredSelection.add(item.id));
        } else {
            list.forEach(item => batchIgnoredSelection.delete(item.id));
        }
        renderIgnoredUI();
    }

    function executeIgnoredBatchAction() {
        if (batchIgnoredSelection.size === 0) return;
        
        const isEnableAction = currentIgnoredTab === 'disabled';
        const actionText = isEnableAction ? '开启提醒' : '关闭提醒';

        showConfirmModal(
            '操作确认',
            `确定要对选中的 ${batchIgnoredSelection.size} 个色号${actionText}吗？`,
            () => {
                let count = 0;
                batchIgnoredSelection.forEach(id => {
                    const item = data.find(d => d.id === id);
                    if(item) {
                        item.monitor = isEnableAction;
                        count++;
                    }
                });

                save();
                render(); 
                showToast(`已批量${actionText} ${count} 个色号`);
            }
        );
    }

    function openLowStockModal() {
        // 获取当前筛选模式
        const seriesMode = document.getElementById('seriesFilter').value;
        
        // 筛选逻辑与 render 保持一致
        const lowList = data.filter(d => {
            // 1. 监控开启且低于阈值
            if (d.monitor === false || d.w >= threshold) return false;
            
            // 2. 系列筛选
            if (seriesMode === 'all') return true;
            // Mard 221 模式下排除 P, Q, R, T, Y, ZG 系列
            const match = d.id.match(/^[A-Z]+/);
            const series = match ? match[0] : '';
            const extraSeries = ['P', 'Q', 'R', 'T', 'Y', 'ZG'];
            return !extraSeries.includes(series);
        });

        const listDiv = document.getElementById('lowStockList');
        const headerDiv = document.getElementById('lowStockHeader');
        listDiv.innerHTML = '';

        if (lowList.length === 0) {
            headerDiv.style.display = 'none';
            listDiv.innerHTML = `
                <div style="padding:30px 10px; text-align:center; color:#999;">
                    <div style="font-size:24px; margin-bottom:10px;">🎉</div>
                    <div style="font-size:13px;">当前库存充足</div>
                    <div style="font-size:11px; margin-top:5px;">暂无低于阈值 (${threshold}g) 的色号</div>
                </div>
            `;
            // 清空复制内容
            document.getElementById('lowStockText').value = '';
        } else {
            headerDiv.style.display = 'flex';
            lowList.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0; background:white;';
                
                row.innerHTML = `
                    <div class="swatch" style="width:28px; height:28px; background:${item.hex}; border-radius:50%; border:1px solid #eee; margin-right:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"></div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b style="font-size:16px; color:#333;">${item.id}</b>
                            <span style="font-size:14px; font-weight:bold; color:#ff4d4f;">${item.w}g</span>
                        </div>
                        <div style="font-size:11px; color:#999; margin-top:2px;">库存不足 (阈值 ${threshold}g)</div>
                    </div>
                `;
                listDiv.appendChild(row);
            });
            
            // 去除最后一行边框
            if(listDiv.lastChild) listDiv.lastChild.style.borderBottom = 'none';

            // 准备复制的文本内容
            const copyText = lowList.map(d => `${d.id}: ${d.w}g`).join('\n');
            document.getElementById('lowStockText').value = copyText;
        }

        showModal('lowStockModal');
    }



    let selectedStatsSeries = new Set();
    let isStatsFilterVisible = false;
    
    // Plan Stats Filter State Removed

    function toggleStatsFilterVisibility() {
        isStatsFilterVisible = !isStatsFilterVisible;
        renderStats();
    }

    function enableStatsLowStock() {
        const checkbox = document.getElementById('stats-low-filter');
        if(checkbox) {
            checkbox.checked = true;
            renderStats();
            showToast('已切换至低库存模式');
        }
    }

    function copyLowStock() {
        // Reuse logic to get current filtered scope
        let seriesMode = document.getElementById('seriesFilter').value;
        const extraSeries = ['P', 'Q', 'R', 'T', 'Y', 'ZG'];
        
        // 1. Base Filter (Series Mode)
        let candidates = data.filter(item => {
            const match = item.id.match(/^[A-Z]+/);
            const series = match ? match[0] : '';
            if (seriesMode === 'all') return true;
            return !extraSeries.includes(series);
        });

        // 2. Stats Series Button Filter
        if (selectedStatsSeries.size > 0) {
            candidates = candidates.filter(item => {
                 const match = item.id.match(/^[A-Z]+/);
                 const series = match ? match[0] : '';
                 return selectedStatsSeries.has(series);
            });
        }

        // 3. Filter Low Stock
        const lowStockItems = candidates.filter(item => item.monitor !== false && (item.w || 0) < threshold);
        
        if (lowStockItems.length === 0) {
            showToast('当前没有缺货色号');
            return;
        }

        // 4. Sort
        lowStockItems.sort((a, b) => {
             const matchA = a.id.match(/^([A-Z]+)(\d+)$/);
             const matchB = b.id.match(/^([A-Z]+)(\d+)$/);
             if (matchA && matchB) {
                 if (matchA[1] !== matchB[1]) return matchA[1].localeCompare(matchB[1]);
                 return parseInt(matchA[2]) - parseInt(matchB[2]);
             }
             return a.id.localeCompare(b.id);
        });

        // 5. Generate Text (IDs only)
        const text = lowStockItems.map(item => item.id).join('\n');
        
        // 6. Copy
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(`已复制 ${lowStockItems.length} 个缺货色号`);
            }).catch(err => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // Prevent scrolling to bottom
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('已复制缺货色号');
        } catch (err) {
            showToast('复制失败');
        }
        document.body.removeChild(textarea);
    }

    function toggleStatsSeries(series) {
        if (selectedStatsSeries.has(series)) {
            selectedStatsSeries.delete(series);
        } else {
            selectedStatsSeries.add(series);
        }
        renderStats();
    }

    function renderStats() {
        // 0. 应用筛选逻辑 (保持与 inventory 页面一致)
        let seriesMode = document.getElementById('seriesFilter').value;
        // Sync stats dropdown to match
        const statsSelect = document.getElementById('statsSeriesFilter');
        if(statsSelect && statsSelect.value !== seriesMode) {
             statsSelect.value = seriesMode;
        }

        const extraSeries = ['P', 'Q', 'R', 'T', 'Y', 'ZG'];
        
        // Base Data: Filtered by Series Mode ONLY (for generating filter buttons)
        let baseStatsData = data.filter(item => {
            const match = item.id.match(/^[A-Z]+/);
            const series = match ? match[0] : '';
            if (seriesMode === 'all') return true;
            return !extraSeries.includes(series);
        });

        // 0.1 Render Stats Series Filter Buttons
        const filterContainer = document.getElementById('statsSeriesFilterContainer');
        const toggleBtn = document.getElementById('btn-toggle-stats-filter');

        if (filterContainer) {
            const seriesSet = new Set();
            baseStatsData.forEach(item => {
                const match = item.id.match(/^[A-Z]+/);
                if (match) seriesSet.add(match[0]);
            });
            const seriesList = Array.from(seriesSet).sort();

            if (seriesList.length <= 1) {
                filterContainer.style.display = 'none';
                if(toggleBtn) toggleBtn.style.display = 'none';
            } else {
                // Show toggle button logic
                if(toggleBtn) {
                    toggleBtn.style.display = 'flex';
                    if (isStatsFilterVisible) {
                        toggleBtn.style.background = '#e6f7ff';
                        toggleBtn.style.borderColor = '#91d5ff';
                    } else {
                        toggleBtn.style.background = '#fff';
                        toggleBtn.style.borderColor = '#ddd';
                    }
                }

                if (isStatsFilterVisible) {
                    filterContainer.style.display = 'flex';
                    filterContainer.innerHTML = '';
                    seriesList.forEach(s => {
                        const isSelected = selectedStatsSeries.has(s);
                        const btn = document.createElement('div');
                        btn.textContent = s;
                        btn.className = `series-chip ${isSelected ? 'selected' : ''}`;
                        btn.onclick = () => toggleStatsSeries(s);
                        filterContainer.appendChild(btn);
                    });
                } else {
                    filterContainer.style.display = 'none';
                }
            }
        }

        // 0.2 Apply Series Button Filter (for Totals and List)
        let statsData = baseStatsData;
        if (selectedStatsSeries.size > 0) {
            statsData = baseStatsData.filter(item => {
                 const match = item.id.match(/^[A-Z]+/);
                 const series = match ? match[0] : '';
                 return selectedStatsSeries.has(series);
            });
        }

        // 1. 基础数据统计
        const totalStock = statsData.reduce((sum, item) => sum + (item.w || 0), 0);
        const totalUsed = statsData.reduce((sum, item) => sum + (item.totalUsed || 0), 0);
        // Low stock: monitor is true (or undefined/default) AND stock < threshold
        const lowCount = statsData.filter(item => item.monitor !== false && (item.w || 0) < threshold).length;
        
        // Calculate Usage Rate: Total Used / Total Stock * 100%
        let usageRate = 0;
        if (totalStock > 0) {
            usageRate = Math.round((totalUsed / totalStock) * 100);
        } else if (totalUsed > 0) {
            usageRate = 100; // Stock is 0 but used > 0, treat as maxed
        }

        // 2. 更新概览数字
        const elTotalStock = document.getElementById('stats-total-stock');
        if(elTotalStock) elTotalStock.textContent = `${totalStock.toFixed(1)}g`;
        
        const elTotalUsed = document.getElementById('stats-total-used');
        if(elTotalUsed) elTotalUsed.textContent = `${totalUsed.toFixed(1)}g`;
        
        const elLowCount = document.getElementById('stats-low-count');
        if(elLowCount) {
            elLowCount.textContent = lowCount;
            elLowCount.style.color = lowCount > 0 ? '#ff4d4f' : '#333';
        }

        // 3. 更新甜甜圈图 (已消耗)
        const donut = document.getElementById('stats-donut');
        const donutPercent = document.getElementById('stats-donut-percent');
        const donutValue = document.getElementById('stats-donut-value');
        if(donut && donutPercent) {
            const visualRate = Math.min(usageRate, 100);
            // Use standard blue/green for usage
            donut.style.background = `conic-gradient(#52c41a 0% ${visualRate}%, #f0f0f0 ${visualRate}% 100%)`;
            donutPercent.textContent = `${usageRate}%`;
            
            if(donutValue) {
                donutValue.textContent = `${totalUsed.toFixed(1)}g`;
            }
        }

        // 3.1 更新计划统计
        updatePlanOverviewStats();

        // 4. 更新排行榜 (Stats Rank List)
        const rankListEl = document.getElementById('stats-rank-list');
        if(!rankListEl) return;
        
        rankListEl.innerHTML = '';

        // Filter by "Low Stock Only" toggle
        const lowFilterEl = document.getElementById('stats-low-filter');
        const showLowOnly = lowFilterEl ? lowFilterEl.checked : false;
        
        let listData = [...statsData];
        if (showLowOnly) {
            listData = listData.filter(item => item.monitor !== false && (item.w || 0) < threshold);
        }

        // Sort by Total Used Descending (Default Rank)
        listData.sort((a, b) => (b.totalUsed || 0) - (a.totalUsed || 0));

        if (listData.length === 0) {
            rankListEl.innerHTML = '<div style="text-align:center; color:#999; padding:20px; font-size:13px;">暂无数据</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const maxUsed = listData.length > 0 ? (listData[0].totalUsed || 0) : 0;

        listData.forEach((item, index) => {
            const itemUsed = item.totalUsed || 0;
            const itemStock = item.w || 0;
            const isLow = item.monitor !== false && itemStock < threshold;
            
            // Progress bar width (relative to max in current list)
            const progressPercent = maxUsed > 0 ? (itemUsed / maxUsed) * 100 : 0;

            const el = document.createElement('div');
            el.className = 'rank-item';
            
            // Rank Badge
            let badgeClass = 'rank-badge';
            if (index === 0) badgeClass += ' top-1';
            else if (index === 1) badgeClass += ' top-2';
            else if (index === 2) badgeClass += ' top-3';
            
            // Color Swatch
            const colorStyle = item.hex ? `background-color: ${item.hex};` : 'background-color: #eee;';
            
            el.innerHTML = `
                <div class="${badgeClass}">${index + 1}</div>
                <div class="rank-swatch" style="${colorStyle}"></div>
                <div class="rank-content">
                    <div class="rank-header">
                        <span class="rank-id">${item.id}</span>
                        <div class="rank-details">
                            <span class="used">用 ${itemUsed.toFixed(1)}g</span>
                            <span class="rem ${isLow ? 'zero' : ''}">余 ${itemStock.toFixed(1)}g</span>
                        </div>
                    </div>
                    <div class="rank-progress-bg">
                        <div class="rank-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            `;
            fragment.appendChild(el);
        });
        
        rankListEl.appendChild(fragment);
    }

    function toggleChartBar(el) {
        // Toggle active state on the clicked bar
        // Optional: Close others
        const isActive = el.classList.contains('active');
        document.querySelectorAll('.chart-bar.active').forEach(b => b.classList.remove('active'));
        if (!isActive) {
            el.classList.add('active');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                el.classList.remove('active');
            }, 3000);
        }
    }

    // Plan Chart Config Global
    let planChartConfig = {
        total: true,
        completed: true,
        pending: true,
        time: true
    };

    function togglePlanChartFilter(type) {
        if (planChartConfig.hasOwnProperty(type)) {
            planChartConfig[type] = !planChartConfig[type];
            updatePlanOverviewStats(); 
        }
    }

    function parseTimeSpentToHours(str) {
        if (!str) return 0;
        str = str.toString().toLowerCase().trim()
                 .replace(/小时/g, 'h')
                 .replace(/分钟/g, 'm')
                 .replace(/分/g, 'm');
        
        let hours = 0;
        const hMatch = str.match(/([\d\.]+)\s*h/);
        if (hMatch) hours += parseFloat(hMatch[1]);
        
        const mMatch = str.match(/([\d\.]+)\s*m/);
        if (mMatch) hours += parseFloat(mMatch[1]) / 60;
        
        // If no unit found but looks like number, assume minutes
        if (!hMatch && !mMatch) {
             const val = parseFloat(str);
             if (!isNaN(val)) hours += val / 60;
        }
        return hours;
    }

    function togglePlanChartVisibility() {
        const chartEl = document.getElementById('stats-plan-chart');
        const btn = document.getElementById('btn-toggle-plan-chart');
        if (!chartEl || !btn) return;

        const isHidden = chartEl.style.display === 'none';
        
        if (isHidden) {
            chartEl.style.display = 'block';
            btn.style.transform = 'rotate(180deg)';
        } else {
            chartEl.style.display = 'none';
            btn.style.transform = 'rotate(0deg)';
        }
    }

    function renderPlanChart(plans) {
        const chartEl = document.getElementById('stats-plan-chart');
        if (!chartEl) return;
        
        // Ensure horizontal scrolling if content overflows
        chartEl.style.overflowX = 'auto';

        // 1. Group data by Month (YYYY-MM)
        const monthMap = new Map(); // "2025-01" -> { total: 0, completed: 0, pending: 0, time: 0 }
        
        // Sort plans by date
        plans.sort((a, b) => (a.created || 0) - (b.created || 0));

        if (plans.length === 0) {
            chartEl.innerHTML = '<div style="text-align:center; color:#ccc; padding:20px; font-size:12px;">暂无计划数据</div>';
            return;
        }

        // Populate Map
        plans.forEach(p => {
            const d = new Date(p.created || Date.now());
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthMap.has(key)) {
                monthMap.set(key, { total: 0, completed: 0, pending: 0, time: 0 });
            }
            const entry = monthMap.get(key);
            entry.total++;
            if (p.status === 'completed') {
                entry.completed++;
                entry.time += parseTimeSpentToHours(p.timeSpent);
            }
            else entry.pending++; 
        });

        // Convert to Array and Sort
        const data = Array.from(monthMap.entries()).map(([key, val]) => ({
            key,
            ...val
        })).sort((a, b) => a.key.localeCompare(b.key));

        // Find Max Value for scaling
        let maxVal = 0;
        data.forEach(d => {
            let localMax = d.total;
            if (planChartConfig.time) localMax = Math.max(localMax, d.time);
            maxVal = Math.max(maxVal, localMax);
        });
        if (maxVal === 0) maxVal = 1;

        // 2. Build HTML
        let html = `<div class="chart-container">`;

        data.forEach(item => {
            const hTotal = (item.total / maxVal) * 100;
            const hComp = (item.completed / maxVal) * 100;
            const hPend = (item.pending / maxVal) * 100;
            const hTime = (item.time / maxVal) * 100;
            
            // Parse date for label (e.g. "2026-01" -> "2026年1月")
            const [y, m] = item.key.split('-');
            const label = `${y}年${parseInt(m)}月`; 

            // Conditional Bar Styles
            const styleTotal = planChartConfig.total ? `height:${hTotal}%; background:#4a90e2;` : `display:none;`;
            const styleComp = planChartConfig.completed ? `height:${hComp}%; background:#52c41a;` : `display:none;`;
            const stylePend = planChartConfig.pending ? `height:${hPend}%; background:#faad14;` : `display:none;`;
            const styleTime = planChartConfig.time ? `height:${hTime}%; background:#722ed1;` : `display:none;`;

            html += `
                <div class="chart-col">
                    <div class="chart-bars-group">
                        <div class="chart-bar" style="${styleTotal}" title="总计: ${item.total}" onclick="toggleChartBar(this)"></div>
                        <div class="chart-bar" style="${styleComp}" title="完成: ${item.completed}" onclick="toggleChartBar(this)"></div>
                        <div class="chart-bar" style="${stylePend}" title="计划: ${item.pending}" onclick="toggleChartBar(this)"></div>
                        <div class="chart-bar" style="${styleTime}" title="耗时: ${item.time.toFixed(1)}h" onclick="toggleChartBar(this)"></div>
                    </div>
                    <div class="chart-label">${label}</div>
                </div>
            `;
        });

        html += `</div>`;
        
        // Add Interactive Legend at Bottom (Removed)
        
        chartEl.innerHTML = html;
    }

    function syncAndRenderStats() {
        const val = document.getElementById('statsSeriesFilter').value;
        const mainSelect = document.getElementById('seriesFilter');
        if(mainSelect && mainSelect.value !== val) {
             mainSelect.value = val;
             // Update localStorage and trigger main render to keep sync
             localStorage.setItem('bead_series_filter', val);
             render(); 
        }
        renderStats();
    }

    // --- 水印功能 --- 新用户欢迎弹窗 ---
    function checkWelcome() {
        const hasVisited = localStorage.getItem('mard_visited');
        if (!hasVisited) {
            showModal('welcomeModal');
        }
    }

    function closeWelcomeModal() {
        localStorage.setItem('mard_visited', 'true');
        closeAllModals();
    }

    function showDevInfo() {
        showModal('devInfoModal');
    }

    // 恢复上次选择的系列
    const savedSeries = localStorage.getItem('bead_series_filter');
    if (savedSeries) {
        document.getElementById('seriesFilter').value = savedSeries;
    }

    // 启动时检查
    window.addEventListener('DOMContentLoaded', () => {
        // Remove init style if exists
        const initStyle = document.getElementById('init-style');
        if(initStyle) initStyle.remove();

        // Check for saved nav state (Refresh Persistence)
        const lastNav = localStorage.getItem('mard_last_nav');
        let restored = false;
        
        if (lastNav) {
            try {
                const nav = JSON.parse(lastNav);
                // Simple validation to prevent loops if bad data
                if (nav && nav.method && nav.arg) {
                    if (nav.method === 'navTo') {
                        navTo(nav.arg);
                        restored = true;
                    } else if (nav.method === 'navToDock') {
                        navToDock(nav.arg);
                        restored = true;
                    }
                }
            } catch(e) {
                console.error("Failed to restore nav state:", e);
                localStorage.removeItem('mard_last_nav');
            }
        }

        if (!restored) {
            // Check default page preference
            const defaultBeads = localStorage.getItem('default_page_beads');
            if (defaultBeads === 'true') {
                document.getElementById('defaultBeadsToggle').checked = true;
                navTo('beads');
            } else {
                navTo('home');
            }
        }

        render();
    });

    // --- Fabric Tool Logic ---

    function toggleDefaultPage() {
        const isChecked = document.getElementById('defaultBeadsToggle').checked;
        if (isChecked) {
            localStorage.setItem('default_page_beads', 'true');
        } else {
            localStorage.removeItem('default_page_beads');
        }
    }
    let specs = [];
    const specColors = ['#f5dce0', '#dcedc8', '#fdf6c6', '#adc6ff', '#d3adf7']; // Pink, Green, Yellow, Blue, Purple

    function addSpec() {
        if (specs.length >= 5) {
            alert("最多添加 5 种规格");
            return;
        }
        specs.push({ w: '', h: '', color: specColors[specs.length] });
        saveFabricState();
        renderSpecs();
    }

    function removeSpec(index) {
        specs.splice(index, 1);
        saveFabricState();
        renderSpecs();
    }

    function updateSpec(index, field, val) {
        // Only allow integers
        const intVal = parseInt(val);
        if (isNaN(intVal)) {
            specs[index][field] = '';
        } else {
            specs[index][field] = intVal;
        }
        saveFabricState();
        renderSpecs();
    }

    function renderSpecs() {
        const list = document.getElementById('specList');
        list.innerHTML = '';
        specs.forEach((s, i) => {
            const div = document.createElement('div');
            div.className = 'spec-item';
            div.innerHTML = `
                <div class="spec-color" style="background:${s.color}"></div>
                <div style="font-size:12px; font-weight:bold; color:#666;">#${i+1}</div>
                <div style="position:relative; flex:1;">
                    <input type="number" value="${s.w}" placeholder="长" onchange="updateSpec(${i}, 'w', this.value)" style="width:100%; padding:4px; padding-right:20px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                    <span style="position:absolute; right:4px; top:50%; transform:translateY(-50%); font-size:10px; color:#999; pointer-events:none;">cm</span>
                </div>
                <span style="font-size:12px; color:#999;">x</span>
                <div style="position:relative; flex:1;">
                    <input type="number" value="${s.h}" placeholder="宽" onchange="updateSpec(${i}, 'h', this.value)" style="width:100%; padding:4px; padding-right:20px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                    <span style="position:absolute; right:4px; top:50%; transform:translateY(-50%); font-size:10px; color:#999; pointer-events:none;">cm</span>
                </div>
                <button class="btn-del" onclick="removeSpec(${i})">×</button>
            `;
            list.appendChild(div);
        });
        updateSortOptions();
    }

    function updateSortOptions() {
        const select = document.getElementById('sortPref');
        if (!select) return;
        const currentVal = select.value;
        
        select.innerHTML = '';
        
        // Define options
        const opts = [
            {v:'all_specs', t:'优先包含全部规格方案'},
            {v:'efficiency', t:'利用率从高到低'}
        ];
        
        // Add dynamic spec options
        specs.forEach((s, i) => {
            opts.push({v:`spec${i+1}`, t:`规格${i+1}数量优先`});
        });
        
        opts.forEach(o => {
            const el = document.createElement('option');
            el.value = o.v;
            el.innerText = o.t;
            select.appendChild(el);
        });
        
        // Restore selection or default to all_specs
        const exists = opts.some(o => o.v === currentVal);
        if (exists) select.value = currentVal;
        else select.value = 'all_specs';
    }

    function saveFabricState() {
        const W = document.getElementById('canvasW').value;
        const H = document.getElementById('canvasH').value;
        const sort = document.getElementById('sortPref').value;
        
        localStorage.setItem('fabric_w', W);
        localStorage.setItem('fabric_h', H);
        localStorage.setItem('fabric_sort', sort);
        localStorage.setItem('fabric_specs', JSON.stringify(specs));
    }

    let currentRenderedSolutions = [];
    let currentFabricW = 0;
    let currentFabricH = 0;

    // --- Algorithm ---
    function calculateLayout() {
        saveFabricState(); // Save state on calculation trigger
        const W = parseFloat(document.getElementById('canvasW').value);
        const H = parseFloat(document.getElementById('canvasH').value);
        
        currentFabricW = W;
        currentFabricH = H;

        const sortPref = document.getElementById('sortPref').value;
        const statusEl = document.getElementById('calcStatus');
        const listEl = document.getElementById('solutionList');

        if (!W || !H || specs.length === 0) {
            alert("请完善尺寸信息");
            return;
        }
        
        statusEl.innerText = "计算中...";
        listEl.innerHTML = ''; 

        // 1. Generate Combinations (Recursion)
        const targetArea = 0.9 * W * H;
        const totalArea = W * H;
        let solutions = [];
        
        // Determine target spec index for priority search
        let targetSpecIndex = -1;
        if (sortPref.startsWith('spec')) {
            targetSpecIndex = parseInt(sortPref.replace('spec', '')) - 1;
        }

        function search(index, currentCounts, currentArea) {
            if (currentArea > totalArea) return;
            
            if (index === specs.length) {
                if (currentArea >= targetArea) {
                    solutions.push({ counts: [...currentCounts], area: currentArea, utilization: currentArea / totalArea });
                }
                return;
            }

            const s = specs[index];
            const sArea = s.w * s.h;
            // Limit max count to avoid infinite loops if size is small
            const maxCnt = Math.min(200, Math.floor((totalArea - currentArea) / sArea));
            
            // Determine iteration order
            // Default: Descending (Max -> 0) to prefer filling space with current spec
            // If targetSpecIndex is set:
            //   - index < targetSpecIndex: Ascending (0 -> Max) to save space for target
            //   - index >= targetSpecIndex: Descending (Max -> 0) to fill space with target and others
            
            let start, end, step;
            let useDescending = true;
            
            if (targetSpecIndex !== -1 && index < targetSpecIndex) {
                useDescending = false;
            }
            
            if (useDescending) {
                start = maxCnt; end = 0; step = -1;
            } else {
                start = 0; end = maxCnt; step = 1;
            }

            for (let c = start; (step > 0 ? c <= end : c >= end); c += step) {
                currentCounts[index] = c;
                search(index + 1, currentCounts, currentArea + c * sArea);
                if (solutions.length > 10000) return; 
            }
        }
        
        search(0, new Array(specs.length).fill(0), 0);

        if (solutions.length === 0) {
            statusEl.innerText = "无满足 >=90% 利用率的方案";
            listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">未找到高利用率方案，建议添加填充件</div>';
            return;
        }

        // 2. Validate Packing
        let validSolutions = [];
        solutions.sort((a, b) => b.utilization - a.utilization);
        const toCheck = solutions; 
        
        const packStrategies = [
            (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h), // Max side desc (default)
            (a, b) => (b.w * b.h) - (a.w * a.h),             // Area desc
            (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h), // Min side desc
            (a, b) => b.w - a.w                                // Width desc
        ];

        for (let sol of toCheck) {
            let items = [];
            sol.counts.forEach((cnt, i) => {
                for(let k=0; k<cnt; k++) items.push({ ...specs[i], id: i });
            });
            
            let bestResult = null;
            
            // Try different packing heuristics to find a fit
            // Combinations of Sort Strategy + Split Strategy (Horizontal/Vertical)
            for (let sortFn of packStrategies) {
                // Try Horizontal Split first (default)
                let result = packItems(W, H, items, sortFn, false);
                if (result) {
                    bestResult = result;
                    break; 
                }
                // Try Vertical Split
                result = packItems(W, H, items, sortFn, true);
                if (result) {
                    bestResult = result;
                    break;
                }
            }
            
            if (bestResult) {
                // Try to fill leftovers (Iterative greedy fill)
                // If we find any spec that fits in the leftovers, add it and re-pack
                let addedAny = false;
                let safetyLimit = 0;
                
                do {
                    addedAny = false;
                    safetyLimit++;
                    if (safetyLimit > 50) break; // Prevent infinite loop
                    
                    let bestExtra = null;
                    let maxExtraArea = 0;
                    
                    // Look for best fitting item across all leftovers
                    for (let l of bestResult.leftovers) {
                        for (let sIdx = 0; sIdx < specs.length; sIdx++) {
                            const s = specs[sIdx];
                            // Check fit (normal and rotated)
                            let fits = (s.w <= l.w && s.h <= l.h) || (s.h <= l.w && s.w <= l.h);
                            if (fits) {
                                const area = s.w * s.h;
                                if (area > maxExtraArea) {
                                    maxExtraArea = area;
                                    bestExtra = { s: s, id: sIdx };
                                }
                            }
                        }
                    }
                    
                    if (bestExtra) {
                        // Add extra item
                        items.push({ ...bestExtra.s, id: bestExtra.id });
                        sol.counts[bestExtra.id]++;
                        
                        // Re-pack with new item set
                        // We must find a valid packing for the new set
                        let improvedResult = null;
                        for (let sortFn of packStrategies) {
                             let res = packItems(W, H, items, sortFn, false); 
                             if (res) { improvedResult = res; break; }
                             res = packItems(W, H, items, sortFn, true); 
                             if (res) { improvedResult = res; break; }
                        }
                        
                        if (improvedResult) {
                            bestResult = improvedResult;
                            addedAny = true;
                            // Update solution stats
                            sol.area += bestExtra.s.w * bestExtra.s.h;
                            sol.utilization = sol.area / totalArea;
                        } else {
                            // Backtrack if failed (should be rare if space exists, but packing is heuristic)
                            items.pop();
                            sol.counts[bestExtra.id]--;
                            addedAny = false; 
                        }
                    }
                } while (addedAny);

                sol.placements = bestResult.placements;
                sol.leftovers = bestResult.leftovers;
                validSolutions.push(sol);
            }
        }

        // 3. Sort Results
        if (sortPref === 'all_specs') {
             validSolutions.sort((a, b) => {
                 const aHasAll = a.counts.every(c => c > 0);
                 const bHasAll = b.counts.every(c => c > 0);
                 if (aHasAll !== bHasAll) return bHasAll ? 1 : -1;
                 return b.utilization - a.utilization;
             });
        } else if (sortPref === 'variety') {
             // Priority: Number of different specs (variety) desc -> Utilization desc
             validSolutions.sort((a, b) => {
                 const varietyA = a.counts.filter(c => c > 0).length;
                 const varietyB = b.counts.filter(c => c > 0).length;
                 if (varietyA !== varietyB) {
                     return varietyB - varietyA; // More variety first
                 }
                 return b.utilization - a.utilization; // Then higher utilization
             });
        } else if (sortPref === 'efficiency') {
            validSolutions.sort((a, b) => b.utilization - a.utilization);
        } else if (sortPref.startsWith('spec')) {
            const specIdx = parseInt(sortPref.replace('spec', '')) - 1;
            validSolutions.sort((a, b) => {
                const countA = a.counts[specIdx] || 0;
                const countB = b.counts[specIdx] || 0;
                return countB - countA;
            });
        }
        
        // Deduplicate solutions based on physical dimensions (user request)
        // Check if generated solution spec dimensions have completely identical combinations
        const uniqueSolutions = [];
        const seenSignatures = new Set();
        
        validSolutions.forEach(sol => {
            // Build signature: sorted list of dimensions "WxH"
            let dims = [];
            sol.counts.forEach((cnt, i) => {
                for(let k=0; k<cnt; k++) {
                    dims.push(`${specs[i].w}x${specs[i].h}`);
                }
            });
            dims.sort();
            const sig = dims.join('|');
            
            if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                uniqueSolutions.push(sol);
            }
        });
        validSolutions = uniqueSolutions;

        // 4. Render All Valid Solutions
        const totalFound = validSolutions.length;
        if (validSolutions.length > 50) {
            validSolutions = validSolutions.slice(0, 50);
        }
        
        currentRenderedSolutions = validSolutions;
        statusEl.innerText = `找到 ${totalFound} 个方案 (仅显示前 ${validSolutions.length} 个)`;
        
        validSolutions.forEach((sol, idx) => {
            renderSolution(sol, idx + 1, W, H);
        });
    }

    function openZoom(idx) {
        currentZoomIdx = idx;
        const sol = currentRenderedSolutions[idx];
        if (!sol) return;
        
        const modal = document.getElementById('zoomModal');
        const canvas = document.getElementById('zoomCanvas');
        const title = document.getElementById('zoomTitle');
        const statsContainer = document.getElementById('zoomStats');
        const W = parseFloat(document.getElementById('canvasW').value);
        const H = parseFloat(document.getElementById('canvasH').value);
        
        modal.style.display = 'flex';
        title.innerText = `方案 #${idx + 1} (${(sol.utilization * 100).toFixed(1)}% 利用率)`;
        
        if (statsContainer) {
            statsContainer.innerHTML = generateStatsHtml(sol);
        }
        
        // Calculate max dimensions for the modal canvas
        // 90vw width, 70vh height max
        const maxW = window.innerWidth * 0.9;
        const maxH = window.innerHeight * 0.7;
        
        const scaleW = maxW / W;
        const scaleH = maxH / H;
        const scale = Math.min(scaleW, scaleH); // Scale to fit
        
        const cw = W * scale;
        const ch = H * scale;
        
        canvas.width = cw;
        canvas.height = ch;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);
        ctx.scale(scale, scale);
        
        // Draw placements
        sol.placements.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            
            // Always show text in zoom mode if reasonable size
            if (p.w * scale > 30 && p.h * scale > 15) {
                ctx.fillStyle = '#000';
                // Fix font size: use physical pixels (16px) divided by scale
                // Previous Math.max(12, ...) caused huge text when zoomed in
                const fontSize = (p.w <= 10 || p.h <= 10) ? 8 : 16;
                ctx.font = `${fontSize/scale}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${p.w}x${p.h}`, p.x + p.w/2, p.y + p.h/2);
            }
        });
        
        // Draw leftovers
        if(sol.leftovers) {
            sol.leftovers.forEach(l => {
                if (l.w > 0.5 && l.h > 0.5) {
                     ctx.strokeStyle = '#888';
                     ctx.setLineDash([5/scale, 5/scale]);
                     ctx.lineWidth = 2 / scale;
                     ctx.strokeRect(l.x, l.y, l.w, l.h);
                     
                     // Show dimensions for leftovers in zoom
                     if (l.w * scale > 40 && l.h * scale > 20) {
                        ctx.fillStyle = '#666';
                        ctx.font = `${12/scale}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`${l.w}x${l.h}`, l.x + l.w/2, l.y + l.h/2);
                     }
                     ctx.setLineDash([]);
                }
            });
        }
    }

    function closeZoom() {
        document.getElementById('zoomModal').style.display = 'none';
    }

    function closeDownloadModal() {
        const modal = document.getElementById('downloadModal');
        const img = document.getElementById('downloadImg');
        // Clear src to save memory
        if (img) img.src = '';
        modal.style.display = 'none';
    }

    async function downloadSolution(idx) {
        // UI Feedback: Immediate response
        const btn = document.getElementById('zoomDownloadBtn');
        const originalText = btn ? btn.innerText : "保存图片";
        if (btn) {
            btn.innerText = "生成中...";
            btn.disabled = true;
            btn.style.opacity = "0.7";
        }

        // Force UI update
        await new Promise(r => setTimeout(r, 50));

        try {
            const sol = currentRenderedSolutions[idx];
            if (!sol) throw new Error("方案数据丢失");
            
            const W = currentFabricW;
            const H = currentFabricH;
            
            // 1. Prepare Text Data (Simplified for mobile reliability)
            const lines = [];
            lines.push({ text: `方案 #${idx+1}`, type: 'title' });
            lines.push({ text: `${W}x${H}cm | 利用率:${(sol.utilization * 100).toFixed(1)}%`, type: 'subtitle' });
            
            // Stats (Limit items to prevent huge images)
            sol.counts.forEach((c, i) => {
                if(c > 0) lines.push({ text: `${specs[i].w}x${specs[i].h}: ${c}`, type: 'item', color: specs[i].color });
            });
            
            // Leftovers
            if (sol.leftovers && sol.leftovers.length > 0) {
                const validLeftovers = sol.leftovers.filter(l => l.w > 0.5 && l.h > 0.5);
                if (validLeftovers.length > 0) {
                     lines.push({ text: "剩余布料:", type: 'header' });
                     const wasteGroups = {};
                     validLeftovers.forEach(l => {
                          const key = `${l.w}x${l.h}`;
                          wasteGroups[key] = (wasteGroups[key] || 0) + 1;
                     });
                     for (let [size, count] of Object.entries(wasteGroups)) {
                          lines.push({ text: `${size}cm: x${count}`, type: 'item-waste' });
                     }
                }
            }

            // 2. Setup Canvas Dimensions
            // NUCLEAR OPTION: Mobile Max Dimension Limit = 800px
            // This ensures it works on even the most restricted WebViews
            let PIXELS_PER_CM = 10; 
            const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
            
            if (isMobile) {
                const maxDimension = Math.max(W, H);
                // Force max 800px to guarantee memory safety and Base64 length safety
                if (maxDimension * PIXELS_PER_CM > 800) {
                    PIXELS_PER_CM = 800 / maxDimension; 
                }
            }
            const scale = PIXELS_PER_CM;
            
            // Layout constants
            const PADDING = 20;
            const LINE_HEIGHT = 28;
            let textSectionHeight = PADDING * 2 + lines.length * LINE_HEIGHT;
            
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(W * scale);
            canvas.height = Math.floor(H * scale + textSectionHeight);
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 3. Draw Layout
            ctx.save();
            ctx.scale(scale, scale);
            sol.placements.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1 / scale;
                ctx.strokeRect(p.x, p.y, p.w, p.h);
                // Simple text
                if (p.w > 5 && p.h > 5) {
                    ctx.fillStyle = '#000';
                    ctx.font = `${12/scale}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${p.w}x${p.h}`, p.x + p.w/2, p.y + p.h/2);
                }
            });
            
            // Draw leftovers
            if(sol.leftovers) {
                sol.leftovers.forEach(l => {
                    if (l.w > 0.5 && l.h > 0.5) {
                         ctx.strokeStyle = '#888';
                         ctx.setLineDash([5/scale, 5/scale]);
                         ctx.lineWidth = 2 / scale;
                         ctx.strokeRect(l.x, l.y, l.w, l.h);
                         // Dimensions
                         if (l.w > 3 && l.h > 3) {
                             ctx.fillStyle = '#666';
                             ctx.font = `${12/scale}px Arial`;
                             ctx.textAlign = 'center';
                             ctx.textBaseline = 'middle';
                             ctx.fillText(`${l.w}x${l.h}`, l.x + l.w/2, l.y + l.h/2);
                         }
                         ctx.setLineDash([]);
                    }
                });
            }
            ctx.restore();
            
            // 4. Draw Info Text
            let currentY = H * scale + PADDING;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            lines.forEach(line => {
                ctx.font = line.type === 'title' ? "bold 20px Arial" : "16px Arial";
                ctx.fillStyle = '#333';
                if (line.color) {
                    ctx.fillStyle = line.color;
                    ctx.fillRect(PADDING, currentY + 4, 12, 12);
                    ctx.fillStyle = '#333';
                    ctx.fillText(line.text, PADDING + 18, currentY);
                } else {
                    ctx.fillText(line.text, PADDING, currentY);
                }
                currentY += LINE_HEIGHT;
            });
            
            // --- ROBUST AUTO DOWNLOAD STRATEGY ---
            
            // 0. HTML5+ Environment (HBuilderX / 5+App / uni-app)
            // This is the BEST way for APKs built with HBuilderX
            if (window.plus && window.plus.gallery) {
                try {
                    var bitmap = new plus.nativeObj.Bitmap("test");
                    bitmap.loadBase64Data(canvas.toDataURL('image/jpeg', 0.9), function() {
                        const fileName = "_doc/solution_" + (new Date()).getTime() + ".jpg";
                        bitmap.save(fileName, {overwrite: true}, function(i) {
                            plus.gallery.save(i.target, function() {
                                showToast("已成功保存到手机相册！");
                                bitmap.clear();
                            }, function(e) {
                                alert("保存到相册失败: " + JSON.stringify(e));
                                bitmap.clear();
                            });
                        }, function(e) {
                            alert("保存文件失败: " + JSON.stringify(e));
                            bitmap.clear();
                        });
                    }, function(e) {
                        alert("图片处理失败: " + JSON.stringify(e));
                    });
                    return; // Stop execution, let the native API handle it
                } catch(e) {
                    console.error("Plus API failed", e);
                }
            }

            // --- DIRECT DOWNLOAD STRATEGY (User Requested) ---
            // Bypass Share API and force direct download to local storage
            
            await new Promise((resolve, reject) => {
                canvas.toBlob(function(blob) {
                    try {
                        if (!blob) {
                            reject(new Error("图片生成失败"));
                            return;
                        }
                        
                        // Force "Stream" type to ensure Android WebViews treat it as a download
                        // instead of opening it in the browser/viewer.
                        const streamBlob = new Blob([blob], { type: "application/octet-stream" });
                        const url = URL.createObjectURL(streamBlob);
                        
                        const link = document.createElement('a');
                        link.style.display = 'none';
                        link.href = url;
                        link.download = `solution_${idx+1}.jpg`;
                        
                        document.body.appendChild(link);
                        link.click();
                        
                        // Cleanup after a delay to ensure click registers
                        setTimeout(() => {
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }, 2000);
                        
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }, 'image/jpeg', 0.8);
            });

            // Fallback for APKs that block blob downloads: Show image for long-press
            // Only runs if the above click() didn't trigger a page navigation/download catch
            if (isMobile) {
                 setTimeout(() => {
                      const fallbackDiv = document.createElement('div');
                      fallbackDiv.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:20px; font-size:12px; z-index:9999; pointer-events:none; opacity:0; transition:opacity 0.5s;';
                      fallbackDiv.innerText = "如果未开始下载，请长按图片保存";
                      document.body.appendChild(fallbackDiv);
                      
                      // Check if we should show fallback
                      // Since we can't detect if download started, we show a non-intrusive toast
                      // AND we open the image in a way that allows long-press if the download failed silently
                      
                      // Re-enable image interaction for long press backup
                      const zoomImg = document.querySelector('#zoomModal img');
                      if(zoomImg) {
                          zoomImg.src = canvas.toDataURL('image/jpeg', 0.8); // Replace preview with full res for saving
                          requestAnimationFrame(() => {
                               fallbackDiv.style.opacity = '1';
                               setTimeout(() => fallbackDiv.remove(), 4000);
                          });
                      }
                 }, 1000);
            }

        } catch (e) {
            alert("操作失败: " + e.message + "\n建议截图保存");
        } finally {
            if (btn) {
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        }
    }

    // Guillotine Packing Algorithm
    function packItems(binW, binH, items, sortFn, splitVertical) {
        // Sort items using provided strategy or default
        let rects = items.map(i => ({...i}));
        if (sortFn) {
            rects.sort(sortFn);
        } else {
            rects.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h)); 
        }

        let root = { x: 0, y: 0, w: binW, h: binH, used: false };
        let placements = [];
        
        for (let r of rects) {
            // Try to find best fit for normal and rotated orientation
            // Strategy: Best Short Side Fit (BSSF) - minimizes the shorter leftover side
            let fit = findBestFit(root, r.w, r.h);
            let fitR = findBestFit(root, r.h, r.w);
            
            let bestNode = null;
            let rotated = false;
            
            if (fit.node && fitR.node) {
                if (fit.score <= fitR.score) {
                    bestNode = fit.node;
                } else {
                    bestNode = fitR.node;
                    rotated = true;
                }
            } else if (fit.node) {
                bestNode = fit.node;
            } else if (fitR.node) {
                bestNode = fitR.node;
                rotated = true;
            }
            
            if (bestNode) {
                let w = rotated ? r.h : r.w;
                let h = rotated ? r.w : r.h;
                splitNode(bestNode, w, h, splitVertical);
                placements.push({ x: bestNode.x, y: bestNode.y, w, h, color: r.color, id: r.id });
            } else {
                return null; 
            }
        }
        
        let leftovers = [];
        collectLeftovers(root, leftovers);
        return { placements, leftovers };
    }

    function findBestFit(root, w, h) {
        let bestNode = null;
        let bestScore = Infinity; // Lower is better (min short side remainder)

        function traverse(node) {
            if (node.used) {
                traverse(node.right);
                traverse(node.down);
            } else if (w <= node.w && h <= node.h) {
                // BSSF: Best Short Side Fit
                let remW = node.w - w;
                let remH = node.h - h;
                let score = Math.min(remW, remH);
                
                if (score < bestScore) {
                    bestScore = score;
                    bestNode = node;
                }
            }
        }
        traverse(root);
        return { node: bestNode, score: bestScore };
    }

    function splitNode(node, w, h, splitVertical) {
        node.used = true;
        if (splitVertical) {
            // Vertical Split: Cut strip of width w
            node.down = { x: node.x, y: node.y + h, w: w, h: node.h - h, used: false };
            node.right = { x: node.x + w, y: node.y, w: node.w - w, h: node.h, used: false };
        } else {
            // Horizontal Split (Default): Cut strip of height h
            node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h, used: false };
            node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h, used: false };
        }
    }
    
    function collectLeftovers(node, list) {
        if (!node) return;
        if (!node.used) {
            if (node.w > 0 && node.h > 0) list.push({x: node.x, y: node.y, w: node.w, h: node.h});
        } else {
            collectLeftovers(node.right, list);
            collectLeftovers(node.down, list);
        }
    }

    function generateStatsHtml(sol) {
        let statsHtml = '';
        sol.counts.forEach((c, i) => {
            if(c > 0) {
                statsHtml += `
                    <div class="sol-stat-row">
                        <span style="display:flex; align-items:center; gap:5px;">
                            <div style="width:10px; height:10px; background:${specs[i].color}; border-radius:2px;"></div>
                            ${specs[i].w}x${specs[i].h}cm
                        </span>
                        <b>x${c}</b>
                    </div>
                `;
            }
        });

        // Generate leftovers stats
        let wasteHtml = '';
        if (sol.leftovers && sol.leftovers.length > 0) {
            // Filter significant leftovers
            const validLeftovers = sol.leftovers.filter(l => l.w > 0.5 && l.h > 0.5);
            if (validLeftovers.length > 0) {
                // Group by size
                const wasteGroups = {};
                validLeftovers.forEach(l => {
                    const key = `${l.w}x${l.h}`;
                    wasteGroups[key] = (wasteGroups[key] || 0) + 1;
                });
                
                wasteHtml = `<div style="margin-top:10px; font-size:12px; color:#999; border-top:1px dashed #eee; padding-top:5px;">
                    <div style="margin-bottom:2px;">剩余布料:</div>`;
                
                for (let [size, count] of Object.entries(wasteGroups)) {
                    wasteHtml += `<div style="display:flex; justify-content:space-between;">
                        <span>${size}cm</span>
                        <span>x${count}</span>
                    </div>`;
                }
                wasteHtml += `</div>`;
            }
        }
        
        return `<div class="sol-info" style="margin-top:15px; width:100%; border-top:1px solid #eee; padding-top:10px;">
                    <div style="margin-bottom:10px; font-weight:bold; font-size:13px; color:#333;">数量统计</div>
                    ${statsHtml}
                    ${wasteHtml}
                </div>`;
    }

    function renderSolution(sol, idx, W, H) {
        const listEl = document.getElementById('solutionList');
        const card = document.createElement('div');
        card.className = 'solution-card';
        
        let statsHtml = '';
        sol.counts.forEach((c, i) => {
            if(c > 0) {
                statsHtml += `
                    <div class="sol-stat-row">
                        <span style="display:flex; align-items:center; gap:5px;">
                            <div style="width:10px; height:10px; background:${specs[i].color}; border-radius:2px;"></div>
                            ${specs[i].w}x${specs[i].h}cm
                        </span>
                        <b>x${c}</b>
                    </div>
                `;
            }
        });

        // Generate leftovers stats
        let wasteHtml = '';
        if (sol.leftovers && sol.leftovers.length > 0) {
            // Filter significant leftovers
            const validLeftovers = sol.leftovers.filter(l => l.w > 0.5 && l.h > 0.5);
            if (validLeftovers.length > 0) {
                // Group by size
                const wasteGroups = {};
                validLeftovers.forEach(l => {
                    const key = `${l.w}x${l.h}`;
                    wasteGroups[key] = (wasteGroups[key] || 0) + 1;
                });
                
                wasteHtml = `<div style="margin-top:10px; font-size:12px; color:#999; border-top:1px dashed #eee; padding-top:5px;">
                    <div style="margin-bottom:2px;">剩余布料:</div>`;
                
                for (let [size, count] of Object.entries(wasteGroups)) {
                    wasteHtml += `<div style="display:flex; justify-content:space-between;">
                        <span>${size}cm</span>
                        <span>x${count}</span>
                    </div>`;
                }
                wasteHtml += `</div>`;
            }
        }

        const scale = Math.min(200 / W, 200 / H); 
        const cw = W * scale;
        const ch = H * scale;
        const canvasId = `cvs-${Date.now()}-${idx}`;
        
        card.innerHTML = `
            <div class="sol-header">
                <span style="font-weight:bold; color:#333; white-space:nowrap;">方案 #${idx}</span>
                <div style="display:flex; gap:5px; align-items:center;">
                    <span class="sol-badge">${(sol.utilization * 100).toFixed(1)}% 利用率</span>
                </div>
            </div>
            <div class="sol-body">
                <div class="sol-canvas-wrapper" onclick="openZoom(${idx-1})" style="cursor:pointer;">
                    <canvas id="${canvasId}" width="${cw}" height="${ch}"></canvas>
                </div>
                <div class="sol-info">
                    <div style="margin-bottom:10px; font-weight:bold; font-size:13px; color:#333;">数量统计</div>
                    ${statsHtml}
                    ${wasteHtml}
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
                         <div style="font-size:12px; color:#999;">总尺寸: ${W}x${H} cm</div>
                    </div>
                </div>
            </div>
        `;
        listEl.appendChild(card);
        
        setTimeout(() => {
            const ctx = document.getElementById(canvasId).getContext('2d');
            ctx.scale(scale, scale);
            
            sol.placements.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1 / scale;
                ctx.strokeRect(p.x, p.y, p.w, p.h);
                
                if (p.w * scale > 20 && p.h * scale > 10) {
                    ctx.fillStyle = '#000';
                    ctx.font = `${10/scale}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${p.w}x${p.h}`, p.x + p.w/2, p.y + p.h/2);
                }
            });
            
            if(sol.leftovers) {
                sol.leftovers.forEach(l => {
                    if (l.w > 0.5 && l.h > 0.5) {
                         ctx.strokeStyle = '#888';
                         ctx.setLineDash([3/scale, 3/scale]);
                         ctx.lineWidth = 1 / scale;
                         ctx.strokeRect(l.x, l.y, l.w, l.h);
                         
                         // Show text if space allows (threshold relaxed)
                         ctx.setLineDash([]);
                    }
                });
            }
        }, 0);
    }
    function toggleMainMenu() {
        const menu = document.getElementById('mainMenuDropdown');
        const isVisible = menu.style.display === 'block';
        menu.style.display = isVisible ? 'none' : 'block';
    }

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        // Handle dropdown menu close (legacy, removing)
        const menu = document.getElementById('mainMenuDropdown');
        if (menu && menu.style.display === 'block') menu.style.display = 'none';

        // Handle bottom sheet close
        const sheet = document.getElementById('moreMenuSheet');
        if (sheet && sheet.classList.contains('show') && e.target === sheet) {
            toggleMoreMenu();
        }
    });

    function navToDock(tab) {
        // Save state for refresh
        localStorage.setItem('mard_last_nav', JSON.stringify({ method: 'navToDock', arg: tab }));

        // Update Pull-to-Refresh behavior
        updatePullToRefresh(tab);

        // Reset all active states
        document.querySelectorAll('.dock-item').forEach(el => el.classList.remove('active'));
        
        // Set active state
        let index = 0;
        if(tab === 'scan') index = 1;
        if(tab === 'plan') index = 2;
        if(tab === 'stats') index = 3;
        if(tab === 'more') index = 4; 
        
        const items = document.querySelectorAll('.dock-item');
        if (items[index]) {
            items[index].classList.add('active');
        }

        // Ensure dock is visible when navigating via dock
        document.getElementById('footer-dock').style.display = 'flex';

        // Hide all main pages first
        document.getElementById('page-beads').style.display = 'none';
        document.getElementById('page-stats').style.display = 'none';
        document.getElementById('page-fabric').style.display = 'none';
        document.getElementById('page-home').style.display = 'none';
        document.getElementById('page-scan').style.display = 'none';
        const pagePlan = document.getElementById('page-plan');
        if (pagePlan) pagePlan.style.display = 'none';
        const pagePlanDetail = document.getElementById('page-plan-detail');
        if (pagePlanDetail) pagePlanDetail.style.display = 'none';
        const pageMore = document.getElementById('page-more');
        if (pageMore) pageMore.style.display = 'none';
        const pageHistory = document.getElementById('page-history');
        if (pageHistory) pageHistory.style.display = 'none';

        if (tab === 'inventory') {
            document.getElementById('page-beads').style.display = 'block';
            const fab = document.getElementById('floatingBatchAddBtn');
            if(fab) fab.style.display = 'flex';
            const homeBtn = document.getElementById('floatingHomeBtn');
            if(homeBtn) homeBtn.style.display = 'flex';
        } else if (tab === 'scan') {
             // Re-use navTo for scan to ensure correct initialization if needed, 
             // but here we just show the div as navTo handles dock hiding which we don't want
             document.getElementById('page-scan').style.display = 'block';
             const fab = document.getElementById('floatingBatchAddBtn');
             if(fab) fab.style.display = 'none';
             const homeBtn = document.getElementById('floatingHomeBtn');
             if(homeBtn) homeBtn.style.display = 'none';
        } else if (tab === 'plan') {
             if (pagePlan) {
                 pagePlan.style.display = 'block';
                 renderPlans();
             }
             const fab = document.getElementById('floatingBatchAddBtn');
             if(fab) fab.style.display = 'none';
             const homeBtn = document.getElementById('floatingHomeBtn');
             if(homeBtn) homeBtn.style.display = 'none';
        } else if (tab === 'stats') {
             document.getElementById('page-stats').style.display = 'block';
             renderStats();
             const fab = document.getElementById('floatingBatchAddBtn');
             if(fab) fab.style.display = 'none';
             const homeBtn = document.getElementById('floatingHomeBtn');
             if(homeBtn) homeBtn.style.display = 'none';
        } else if (tab === 'more') {
             if (pageMore) pageMore.style.display = 'block';
             const fab = document.getElementById('floatingBatchAddBtn');
             if(fab) fab.style.display = 'none';
             const homeBtn = document.getElementById('floatingHomeBtn');
             if(homeBtn) homeBtn.style.display = 'none';
        }
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    // --- 扫描功能 ---
    let cropper = null;
    let currentScanResults = new Map();
    let currentScanRawText = '';
    let currentScanSortType = 'code'; // 'code' | 'qty'
    let currentScanPrioritizeMissing = false;

    function toggleScanSort(type) {
        if (currentScanSortType === type) return;
        currentScanSortType = type;
        renderScanResults();
    }

    function toggleScanMissingPriority() {
        currentScanPrioritizeMissing = !currentScanPrioritizeMissing;
        renderScanResults();
    }

    function handleScanImage(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = document.getElementById('scanPreviewImg');
                img.src = e.target.result;
                
                // UI Switch to Crop Mode (Preview Only)
                document.getElementById('scanPreview').style.display = 'none';
                document.getElementById('cropContainer').style.display = 'block';
                document.getElementById('cropControls').style.display = 'flex';
                document.getElementById('scanResult').style.display = 'none';
                
                // DO NOT Initialize Cropper here. Just show the image.
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
            };
            
            reader.readAsDataURL(file);
        }
    }

    let pendingScanBlob = null;
    let currentPreviewZoom = 1;

    // Triggered by "开始裁切"
    function openCropEditor() {
        const sourceImg = document.getElementById('scanPreviewImg');
        const editImg = document.getElementById('cropEditImage');
        
        if (!sourceImg.src) return;
        
        editImg.src = sourceImg.src;
        // Use flex to ensure full screen layout works
        document.getElementById('cropEditModal').style.display = 'flex';
        
        // Destroy previous instance if any
        if (cropper) {
            cropper.destroy();
        }
        
        // Initialize Cropper in Full Screen Modal
        cropper = new Cropper(editImg, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.95,
            background: true, 
            responsive: true,
            rotatable: true,
            scalable: true
        });
    }

    function closeCropEditor() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        document.getElementById('cropEditModal').style.display = 'none';
    }

    // Triggered by "预览" in Edit Modal
    function showCropPreview() {
        if (!cropper) return;
        
        // 1. Get High Quality Crop
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: '#fff'
        });
        
        // 2. Show Preview Modal
        const previewImg = document.getElementById('cropPreviewImage');
        previewImg.src = canvas.toDataURL();
        
        // Reset Zoom
        currentPreviewZoom = 1;
        previewImg.style.transform = `scale(${currentPreviewZoom})`;
        
        // Show Preview on top of Edit Modal
        document.getElementById('cropPreviewModal').style.display = 'flex';
        
        // Save blob for later confirmation
        canvas.toBlob((blob) => {
            pendingScanBlob = blob;
        }, 'image/png');
    }

    function closeCropPreview() {
        // Just hide Preview, revealing Edit Modal below
        document.getElementById('cropPreviewModal').style.display = 'none';
    }

    function zoomPreview(delta) {
        currentPreviewZoom += delta;
        if (currentPreviewZoom < 0.2) currentPreviewZoom = 0.2;
        if (currentPreviewZoom > 5) currentPreviewZoom = 5;
        document.getElementById('cropPreviewImage').style.transform = `scale(${currentPreviewZoom})`;
    }

    async function confirmScanFromPreview() {
        if (!pendingScanBlob) return;
        
        // Hide All Modals
        closeAllModals();
        
        // Clean up cropper
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        
        // Proceed with Scan
        await performScan(pendingScanBlob);
        
        // Clear pending
        pendingScanBlob = null;
    }

    function reCropImage() {
        // Just reset the zoom level for the next preview
        currentPreviewZoom = 1;
        const img = document.getElementById('cropPreviewImage');
        if(img) img.style.transform = `scale(${currentPreviewZoom})`;
        
        // Close preview modal if open
        closeAllModals();

        // The cropper on the main page is still active, so user can just adjust and click crop again.
    }

    function preprocessCanvas(sourceCanvas) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Scale up (2.5x) for clearer text
        const scale = 2.5;
        canvas.width = sourceCanvas.width * scale;
        canvas.height = sourceCanvas.height * scale;
        
        // Draw scaled image
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        
        // Grayscale & Binarization (Thresholding)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const threshold = 160; // Threshold value (0-255)
        
        for (let i = 0; i < data.length; i += 4) {
            // Luma (Grayscale)
            const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            
            // Binarization: Black or White
            const val = avg < threshold ? 0 : 255;
            
            data[i] = val;     // R
            data[i + 1] = val; // G
            data[i + 2] = val; // B
            // Alpha (data[i+3]) remains unchanged
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    async function performScan(file) {
        // UI Updates for Scan Start
        const blobUrl = URL.createObjectURL(file);
        document.getElementById('scanResultImage').src = blobUrl;
        
        // Set Original Full Image
        const originalImg = document.getElementById('scanPreviewImg');
        const fullImgEl = document.getElementById('scanResultFullImage');
        if (fullImgEl && originalImg) {
            fullImgEl.src = originalImg.src;
        }

        // Set Process Previews
        document.getElementById('scanProcessOriginal').src = originalImg.src;
        document.getElementById('scanProcessCropped').src = blobUrl;
        document.getElementById('cropContainer').style.display = 'none';
        document.getElementById('scanProcessPreviews').style.display = 'block';

        document.getElementById('scanLoading').style.display = 'flex';
        document.getElementById('cropControls').style.display = 'none'; // Lock controls
        document.getElementById('scanResult').style.display = 'none';
        // Hide crop container during loading to keep UI clean
        // document.getElementById('cropContainer').style.display = 'none'; // Already hidden above
        
        const statusEl = document.getElementById('scanStatusText');
        statusEl.innerText = "正在连接 Gemini AI 进行智能识别...";

        try {
            // 1. Convert Blob to Base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result;
                    // Remove "data:image/png;base64," prefix
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // 2. Dynamic Model Discovery & Prioritization
            // API Key will be retrieved per model to ensure load balancing
            statusEl.innerText = "正在获取可用模型列表...";
            
            let candidateModels = [];
            // const defaultModel = 'gemini-2.0-flash'; // Unused


            // --- Model Usage Tracking Logic (User Request) ---
            // Using Global ModelUsageManager defined in main script

            // Define strict priority list as requested
            let priorityList = [
                'gemini-3-flash-preview',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite'
            ];

            // Filter by usage limit
            candidateModels = [];
            for (const m of priorityList) {
                if (ModelUsageManager.canUse(m)) {
                    candidateModels.push(m);
                } else {
                    console.log(`Model ${m} reached daily limit (${ModelUsageManager.limit}). Skipping.`);
                }
            }
            
            if (candidateModels.length === 0) {
                 console.warn("All custom models exhausted. Using fallback (Lite).");
                 // Fallback to the most economical model if all limits are reached
                 candidateModels = ['gemini-2.5-flash-lite']; 
            }

            console.log("Candidate Models Sequence:", candidateModels);

            // 3. Loop through models (Failover Logic)
            let result = null;
            let lastError = null;
            let usedModel = '';
            
            const prompt = `
                Analyze this image of a bead inventory list.
                Identify all color codes (e.g., A1, B-2, 310, 823) and their corresponding quantities (numbers).
                The quantity is usually physically located below or next to the color code.
                Pay attention to the grid layout.
                
                Return a JSON object where keys are the color codes (string) and values are the quantities (integer).
                Example format: {"A1": 50, "B2": 30, "310": 100}
                
                IMPORTANT: Return ONLY the valid JSON string. Do not include markdown formatting like \`\`\`json.
            `;

            for (const modelName of candidateModels) {
                try {
                    statusEl.innerText = `正在尝试使用 ${modelName} ...`;
                    // Visual feedback on retry
                    if (lastError) {
                        statusEl.innerText += ` (自动切换中)`;
                    }

                    console.log(`Attempting model: ${modelName}`);
                    
                    const keyObj = ModelUsageManager.getUsableKeyObj(modelName);
                    if (!keyObj || !keyObj.apiKey) throw new Error("No available API Key for this model (Quota exceeded)");
                    
                    const dynamicKey = keyObj.apiKey;
                    const usedKeyId = keyObj.keyId;

                    // Support multiple API versions for newer/preview models
                    const apiVersions = ['v1beta', 'v1alpha'];
                    let response = null;
                    let success = false;
                    let fetchError = null;

                    for (const version of apiVersions) {
                        try {
                            const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${dynamicKey}`;
                            
                            const attemptResp = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{
                                        parts: [
                                            { text: prompt },
                                            { inline_data: { mime_type: "image/png", data: base64Data } }
                                        ]
                                    }]
                                })
                            });

                            if (attemptResp.status === 404 && version === 'v1beta') {
                                console.warn(`Model ${modelName} not found in v1beta, trying v1alpha...`);
                                continue; // Try next version
                            }

                            if (!attemptResp.ok) {
                                const errData = await attemptResp.json();
                                throw new Error(errData.error?.message || `API Status ${attemptResp.status}`);
                            }

                            response = attemptResp;
                            success = true;
                            break; // Success
                        } catch (verErr) {
                            fetchError = verErr;
                            // If it's a 404, we might retry loop. If other error (like 429), stop trying versions and fail model.
                            if (!verErr.message.includes('404') && !verErr.message.includes('Not Found')) {
                                break;
                            }
                        }
                    }

                    if (!success) {
                        throw fetchError || new Error("Model not found in any API version");
                    }

                    result = await response.json();
                    usedModel = modelName;
                    console.log(`Success with model: ${modelName} using KeyID: ${usedKeyId}`);
                    ModelUsageManager.increment(modelName, usedKeyId); // Track usage for specific key
                    break; // Success! Exit loop

                } catch (e) {
                    console.warn(`Model ${modelName} failed:`, e.message);
                    lastError = e;
                    
                    // Show specific error to user and pause briefly so they can see why it failed
                    const shortMsg = e.message.length > 60 ? e.message.slice(0, 60) + '...' : e.message;
                    let friendlyMsg = shortMsg;
                    if (e.message.includes('404')) friendlyMsg = "模型不存在 (404)";
                    if (e.message.includes('400')) friendlyMsg = "请求无效 (400)";
                    if (e.message.includes('429')) friendlyMsg = "额度耗尽 (429)";
                    if (e.message.includes('403') || e.message.includes('401')) friendlyMsg = "API Key 无效";
                    
                    statusEl.innerHTML = `<span style="color:#ff4d4f">❌ ${modelName} 失败: ${friendlyMsg}</span><br>🔄 正在切换下一模型...`;
                    
                    // Wait 2 seconds before trying next model
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!result) {
                throw lastError || new Error("所有可用模型均尝试失败，请检查网络或 Key 配额。");
            }
            
            // 4. Parse Response
            const candidate = result.candidates?.[0];
            if (!candidate) throw new Error("No response candidates from Gemini");

            if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
                 console.error("Gemini Candidate Error:", candidate);
                 // Check if it's a safety block
                 if (candidate.finishReason === 'SAFETY') {
                     throw new Error("图片内容被 AI 安全策略拦截，无法识别。");
                 }
                 throw new Error("Gemini 响应内容为空或格式错误");
            }

            const rawText = candidate.content.parts[0].text;
            console.log("Gemini Raw:", rawText);
            
            // Clean markdown if present (just in case)
            const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let dataMap;
            try {
                dataMap = JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error", e);
                throw new Error("Gemini 返回了无法解析的数据格式");
            }
            
            // Convert to Map for existing render function
            const codeMap = new Map();
            Object.entries(dataMap).forEach(([key, value]) => {
                // Basic cleanup of keys (uppercase) and values (int)
                codeMap.set(key.toUpperCase(), parseInt(value));
            });

            // 5. Render Results
            document.getElementById('scanLoading').style.display = 'none';
            document.getElementById('scanResult').style.display = 'block';
            document.getElementById('scan-uploader').style.display = 'none'; // Hide uploader area
            
            // Store global state
            currentScanResults = codeMap;
            currentScanRawText = `[Used Model: ${usedModel}]\n` + rawText;

            renderScanResults();

        } catch (err) {
            console.error(err);
            alert('识别出错: ' + (err.message || "未知错误"));
            document.getElementById('scanLoading').style.display = 'none';
            document.getElementById('cropControls').style.display = 'flex'; // Restore controls
            document.getElementById('cropContainer').style.display = 'block'; // Restore crop container
            document.getElementById('scanProcessPreviews').style.display = 'none'; // Hide process previews
        }
    }

    function cancelScan() {
        // Just reload for now as simple cancellation
        resetScan();
    }

    // Removed old analyzeScanResult as Gemini handles logic now

    function renderScanResults() {
        // Ensure status bar is hidden
        document.getElementById('scanInlineStatus').style.display = 'none';

        const listContainer = document.getElementById('scanList');
        listContainer.innerHTML = '';
        
        const codeMap = currentScanResults;
        const rawText = currentScanRawText;

        // Update sort buttons state
        const btnCode = document.getElementById('btn-sort-code');
        const btnQty = document.getElementById('btn-sort-qty');
        const btnMissing = document.getElementById('btn-scan-missing');
        
        if(btnCode && btnQty && btnMissing) {
            const activeStyle = "font-size: 12px; padding: 2px 8px; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; font-weight: bold;";
            const inactiveStyle = "font-size: 12px; padding: 2px 8px; border: 1px solid #ddd; background: #fff; color: #666; border-radius: 4px;";
            
            btnCode.style.cssText = currentScanSortType === 'code' ? activeStyle : inactiveStyle;
            btnQty.style.cssText = currentScanSortType === 'qty' ? activeStyle : inactiveStyle;
            btnMissing.style.cssText = currentScanPrioritizeMissing ? activeStyle : inactiveStyle;
        }

        // Update header count
        const countEl = document.getElementById('scanTotalCount');
        if (countEl) {
            let totalQty = 0;
            codeMap.forEach(qty => totalQty += qty);
            countEl.innerHTML = `<span style="background:#e6f7ff; color:#1890ff; padding:2px 8px; border-radius:10px; font-weight:bold;">${codeMap.size} 色 / ${totalQty} 粒</span>`;
        }

        // --- Debug Details Section ---
        const detailsId = 'scan-debug-details';
        let detailsBtn = document.getElementById('scan-debug-btn');
        let detailsEl = document.getElementById(detailsId);
        
        if (!detailsEl) {
             const btn = document.createElement('button');
             btn.id = 'scan-debug-btn';
             btn.className = 'm-btn m-btn-ghost';
             btn.style.marginTop = '10px';
             btn.style.fontSize = '12px';
             btn.innerText = '🔍 显示/隐藏 识别详情 (Debug)';
             btn.onclick = () => {
                 const el = document.getElementById(detailsId);
                 el.style.display = el.style.display === 'none' ? 'block' : 'none';
             };
             
             detailsEl = document.createElement('div');
             detailsEl.id = detailsId;
             detailsEl.style.display = 'none';
             detailsEl.style.marginTop = '10px';
             detailsEl.style.padding = '10px';
             detailsEl.style.background = '#f5f5f5';
             detailsEl.style.border = '1px solid #ddd';
             detailsEl.style.borderRadius = '8px';
             detailsEl.style.fontSize = '11px';
             detailsEl.style.fontFamily = 'monospace';
             detailsEl.style.whiteSpace = 'pre-wrap';
             detailsEl.style.wordBreak = 'break-all';
             
             document.getElementById('scanResult').appendChild(btn);
             document.getElementById('scanResult').appendChild(detailsEl);
        }
        
        // Update debug info
        if (detailsEl) {
            detailsEl.innerText = 
                `=== Raw Text ===\n${rawText}\n\n=== Parsed Pairs ===\n${JSON.stringify(Array.from(codeMap.entries()), null, 2)}`;
        }


        // --- Main List Rendering ---
        if (codeMap.size === 0) {
            listContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #fa8c16; background: #fffbe6; border-radius: 8px; border: 1px solid #ffe58f;">
                    未识别到有效的色号数据。<br>请尝试调整裁切区域，确保只包含【色号和数量】。
                </div>
            `;
            // Add "Add Manually" button even if empty
             const addBtn = document.createElement('button');
             addBtn.className = 'm-btn m-btn-ghost';
             addBtn.style.marginTop = '10px';
             addBtn.innerHTML = '+ 手动添加色号';
             addBtn.onclick = addScanItem;
             listContainer.appendChild(addBtn);
            return;
        }

        let totalMissing = 0;
        let missingCodes = 0;
        const BEAD_WEIGHT_PER_100 = 1; 

        // Convert map to array for sorting
        let sortedEntries = Array.from(codeMap.entries());
        
        // 1. Primary Sort (Code or Qty)
        if (currentScanSortType === 'qty') {
            sortedEntries.sort((a, b) => b[1] - a[1]);
        } else {
            sortedEntries.sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true}));
        }

        // 2. Priority Sort (Missing First)
        if (currentScanPrioritizeMissing) {
            sortedEntries.sort((a, b) => {
                const getShortage = (code, qty) => {
                    const item = data.find(d => d.id === code);
                    const stock = item ? (item.w || 0) : 0;
                    const requiredWeight = qty / 100 * BEAD_WEIGHT_PER_100;
                    return stock < requiredWeight ? 1 : 0; // 1 = missing, 0 = ok
                };
                
                const missingA = getShortage(a[0], a[1]);
                const missingB = getShortage(b[0], b[1]);
                
                return missingB - missingA; // Missing first (descending order of isMissing)
            });
        }

        sortedEntries.forEach(([code, qty]) => {
            const item = data.find(d => d.id === code);
            const stock = item ? (item.w || 0) : 0;
            const hex = item ? item.hex : '#f0f0f0';
            
            const isUnknown = !item;
            
            const requiredWeight = qty / 100 * BEAD_WEIGHT_PER_100;
            const isMissing = !isUnknown && stock < requiredWeight;
            const shortage = isMissing ? (requiredWeight - stock) : 0;
            
            if (isMissing) {
                totalMissing += shortage;
                missingCodes++;
            }

            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0; background:white; border-radius:8px; margin-bottom:8px;';
            
            // Unknown Color Logic
            if (isUnknown) {
                 row.style.borderLeft = '4px solid #fa8c16';
                 row.style.background = '#fff7e6';
            }

            row.innerHTML = `
                <div class="swatch" onclick="openScanColorModal('${code}')" style="width:30px; height:30px; background:${hex}; border-radius:50%; border:1px solid #ddd; margin-right:12px; flex-shrink:0; cursor:pointer; position:relative;">
                    <div style="position:absolute; right:-2px; bottom:-2px; background:white; border-radius:50%; width:12px; height:12px; display:flex; align-items:center; justify-content:center; border:1px solid #ddd;">
                        <span style="font-size:8px; color:#666;">▼</span>
                    </div>
                </div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <b style="font-size:16px; color:#333;">
                            ${code} 
                            ${isUnknown ? '<span style="font-size:10px; background:#fa8c16; color:white; padding:2px 4px; border-radius:4px; margin-left:5px; vertical-align:middle;">系统无此色号</span>' : ''}
                        </b>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span onclick="openScanQtyModal('${code}')" style="font-size:14px; color:#1890ff; background:#e6f7ff; padding:2px 8px; border-radius:4px; cursor:pointer; border:1px dashed #91d5ff;">
                                需 ${qty}粒 ✎
                            </span>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
                        ${isUnknown 
                            ? `<span style="color:#fa8c16;">请确认色号是否正确或点击左侧修改</span>` 
                            : `<span style="color:#999;">库存: ${stock}g</span>
                               ${isMissing 
                                   ? `<span style="color:#ff4d4f; font-weight:bold;">缺 ${shortage.toFixed(1)}g</span>` 
                                   : '<span style="color:#52c41a; font-weight:bold;">充足</span>'}`
                        }
                    </div>
                </div>
                <div style="margin-left:10px;">
                    <button onclick="deleteScanItem('${code}')" style="background:none; border:none; color:#999; padding:5px; cursor:pointer; font-size:24px; line-height: 1;">×</button>
                </div>
            `;
            listContainer.appendChild(row);
        });
        
        // Summary Card
        const summaryCard = document.createElement('div');
        if (missingCodes > 0) {
            summaryCard.innerHTML = `⚠️ 共缺货 <b>${missingCodes}</b> 种 (需补 ${totalMissing.toFixed(1)}g)`;
            summaryCard.style.cssText = 'padding: 10px; background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; border-radius: 8px; margin-bottom: 10px; text-align: center; font-size: 13px;';
        } else {
            summaryCard.innerHTML = `🎉 库存全部充足！`;
            summaryCard.style.cssText = 'padding: 10px; background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; border-radius: 8px; margin-bottom: 10px; text-align: center; font-size: 13px;';
        }
        listContainer.insertBefore(summaryCard, listContainer.firstChild);

        // Add "Add" Button
        const addBtn = document.createElement('button');
        addBtn.className = 'm-btn m-btn-ghost';
        addBtn.style.marginTop = '10px';
        addBtn.style.width = '100%';
        addBtn.innerHTML = '+ 添加色号';
        addBtn.onclick = addScanItem;
        listContainer.appendChild(addBtn);
    }

    let currentScanEditCode = null;

    // --- Scan Qty Modify Modal Logic ---
    function openScanQtyModal(code) {
        currentScanEditCode = code;
        const currentQty = currentScanResults.get(code);
        
        document.getElementById('scanQtyCode').innerText = code;
        document.getElementById('scanQtyInput').value = currentQty;
        
        showModal('scanQtyModal');
    }

    function adjustScanQty(delta) {
        const input = document.getElementById('scanQtyInput');
        let val = parseInt(input.value) || 0;
        val += delta;
        if (val < 0) val = 0;
        input.value = val;
    }

    function submitScanQty() {
        if (!currentScanEditCode) return;
        const input = document.getElementById('scanQtyInput');
        const val = parseInt(input.value);
        
        if (!isNaN(val) && val >= 0) {
            currentScanResults.set(currentScanEditCode, val);
            renderScanResults();
            closeAllModals();
            showToast(`已更新色号 ${currentScanEditCode} 数量`);
        } else {
            alert("请输入有效的数字！");
        }
    }

    // --- Scan Color Select Modal Logic ---
    function openScanColorModal(code) {
        currentScanEditCode = code;
        document.getElementById('scanColorSearch').value = '';
        renderScanColorList('');
        showModal('scanColorModal');
        // Auto focus search
        setTimeout(() => document.getElementById('scanColorSearch').focus(), 100);
    }

    function filterScanColorList() {
        const filter = document.getElementById('scanColorSearch').value;
        renderScanColorList(filter);
    }

    function renderScanColorList(filter) {
        const container = document.getElementById('scanColorList');
        container.innerHTML = '';
        
        const filterText = filter.toUpperCase();
        
        // Use 'data' global variable which contains all beads
        const filtered = data.filter(d => d.id.toUpperCase().includes(filterText));
        
        // Limit results for performance if empty filter
        const displayList = (filterText === '' ? filtered.slice(0, 50) : filtered);
        
        if (displayList.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">无匹配色号</div>';
            return;
        }

        displayList.forEach(item => {
            const isCurrent = item.id === currentScanEditCode;
            const div = document.createElement('div');
            div.style.cssText = `display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee; background:${isCurrent ? '#e6f7ff' : 'white'}; cursor:pointer; border-radius:8px; margin-bottom:5px;`;
            div.onclick = () => selectScanColor(item.id);
            
            div.innerHTML = `
                <div style="width:30px; height:30px; background:${item.hex}; border-radius:50%; border:1px solid #ddd; margin-right:15px;"></div>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#333;">${item.id}</div>
                    <div style="font-size:12px; color:#999;">库存: ${item.w || 0}g</div>
                </div>
                ${isCurrent ? '<span style="color:#1890ff; font-weight:bold;">当前</span>' : ''}
            `;
            container.appendChild(div);
        });
        
        if (filterText === '' && data.length > 50) {
            const more = document.createElement('div');
            more.style.cssText = 'text-align:center; padding:10px; color:#999; font-size:12px;';
            more.innerText = `显示前 50 个结果 (共 ${data.length} 个)，请输入搜索词查找`;
            container.appendChild(more);
        }
    }

    function selectScanColor(newCode) {
        if (!currentScanEditCode || currentScanEditCode === newCode) {
            closeAllModals();
            return;
        }

        // Check if new code already exists in scan results
        const existingQty = currentScanResults.get(newCode);
        const currentQty = currentScanResults.get(currentScanEditCode);

        if (existingQty !== undefined) {
             // Merge qty? Or overwrite? User intent implies switching identity. 
             // Let's ask or just merge. Merging seems safer for "switching" if user made a mistake.
             // But usually switching means "I identified this wrong, it's actually X".
             // If X is already in the list, we should probably add the qty to X and remove the old entry.
             if(confirm(`列表里已经存在色号 ${newCode} (数量: ${existingQty})。\n是否合并数量？\n(如果不合并，将覆盖原有数量)`)) {
                 currentScanResults.set(newCode, existingQty + currentQty);
             } else {
                 // Do nothing? or set to currentQty? 
                 // Let's assume merge is preferred, but if cancelled, maybe just replace value
                 currentScanResults.set(newCode, currentQty); 
             }
        } else {
            // New entry
            currentScanResults.set(newCode, currentQty);
        }
        
        // Remove old entry
        currentScanResults.delete(currentScanEditCode);
        
        renderScanResults();
        closeAllModals();
        showToast(`已切换为色号 ${newCode}`);
    }


    let currentScanDeleteCode = null;

    function deleteScanItem(code) {
        currentScanDeleteCode = code;
        document.getElementById('scanDeleteCode').innerText = code;
        showModal('scanDeleteConfirmModal');
    }

    function confirmDeleteScanItem() {
        if (currentScanDeleteCode) {
            currentScanResults.delete(currentScanDeleteCode);
            renderScanResults();
            closeAllModals();
            showToast(`已删除色号 ${currentScanDeleteCode}`);
        }
    }

    function addScanItem() {
        document.getElementById('scanAddCodeInput').value = '';
        document.getElementById('scanAddQtyInput').value = '0';
        showModal('scanAddModal');
        setTimeout(() => document.getElementById('scanAddCodeInput').focus(), 100);
    }

    function adjustAddScanQty(delta) {
        const input = document.getElementById('scanAddQtyInput');
        let val = parseInt(input.value) || 0;
        val += delta;
        if (val < 0) val = 0;
        input.value = val;
    }

    function submitAddScanItem() {
        const codeInput = document.getElementById('scanAddCodeInput');
        const qtyInput = document.getElementById('scanAddQtyInput');
        
        const code = codeInput.value.toUpperCase().trim();
        const qty = parseInt(qtyInput.value);

        if (!code) {
            showToast("请输入色号！");
            return;
        }

        if (isNaN(qty) || qty < 0) {
            showToast("请输入有效的数量！");
            return;
        }

        if (currentScanResults.has(code)) {
            showToast(`色号 ${code} 已存在！请直接在列表中修改数量。`);
            return;
        }

        currentScanResults.set(code, qty);
        renderScanResults();
        closeAllModals();
        showToast(`已添加色号 ${code}`);
        
        // Scroll to bottom or new item? 
        // renderScanResults might sort, so we can't easily scroll to it without finding it.
    }

    function resetScan() {
        document.getElementById('scanInput').value = '';
        document.getElementById('scanPreviewImg').src = '';
        
        // Reset UI visibility
        document.getElementById('scan-uploader').style.display = 'block'; // Show uploader area
        document.getElementById('scanPreview').style.display = 'block';
        document.getElementById('cropContainer').style.display = 'none';
        document.getElementById('scanProcessPreviews').style.display = 'none';
        document.getElementById('cropControls').style.display = 'none';
        document.getElementById('scanResult').style.display = 'none';
        document.getElementById('scanLoading').style.display = 'none';
        
        // Clean up cropper
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    }

    function toggleMoreMenu() {
        const sheet = document.getElementById('moreMenuSheet');
        if (sheet.classList.contains('show')) {
            sheet.classList.remove('show');
            setTimeout(() => { sheet.style.display = 'none'; }, 300);
        } else {
            sheet.style.display = 'block';
            // Trigger reflow
            sheet.offsetHeight; 
            sheet.classList.add('show');
        }
    }

    // --- 拼豆计划功能 ---

    function createPlan() {
        if (!currentScanResults || currentScanResults.size === 0) {
            alert('当前没有识别结果，无法创建计划。请先扫描图纸。');
            return;
        }

        const nameInput = document.getElementById('planNameInput');
        let planName = nameInput.value.trim();
        if (!planName) {
            const date = new Date();
            planName = `未命名计划 ${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        }

        // Capture Thumbnail
        let thumbnail = null;
        try {
            const originalImg = document.getElementById('scanPreviewImg');
            if (originalImg && originalImg.src && originalImg.naturalWidth > 0) {
                 // Create thumbnail from ORIGINAL image
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 const maxDim = 1024; // Increased from 300 to 1024 for better quality
                 let w = originalImg.naturalWidth;
                 let h = originalImg.naturalHeight;
                 
                 if (w > h) {
                     if (w > maxDim) { h *= maxDim / w; w = maxDim; }
                 } else {
                     if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                 }
                 
                 canvas.width = w;
                 canvas.height = h;
                 ctx.drawImage(originalImg, 0, 0, w, h);
                 thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            } else if (typeof cropper !== 'undefined' && cropper) {
                // Fallback to cropper
                // Get full size cropped image instead of 150px
                thumbnail = cropper.getCroppedCanvas({
                    maxWidth: 1024,
                    maxHeight: 1024
                }).toDataURL('image/jpeg', 0.8);
            }
        } catch(e) {
            console.warn('Failed to create thumbnail', e);
        }

        const planItems = [];
        currentScanResults.forEach((qty, code) => {
            planItems.push({ code, qty });
        });

        // Get existing plans
        let plans = [];
        try {
            plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        } catch(e) {
            console.error('Error loading plans', e);
        }

        const newPlan = {
            id: 'plan_' + Date.now(),
            name: planName,
            createdAt: Date.now(),
            items: planItems,
            status: 'active', // active, completed
            thumbnail: thumbnail
        };

        plans.unshift(newPlan); // Add to top
        localStorage.setItem('bead_plans', JSON.stringify(plans));

        showToast(`计划 "${planName}" 创建成功！`);
        
        // Optional: clear input
        nameInput.value = '';
        resetScan(); // Auto clear scan page
        navToDock('plan');
        setPlanFilter('active');
    }

    function deductInventory() {
        if (!currentScanResults || currentScanResults.size === 0) {
            alert('当前没有识别结果，无法扣减库存。');
            return;
        }

        // 1. Create Plan
        const date = new Date();
        // Check for user provided name
        const nameInput = document.getElementById('planNameInput');
        let userPlanName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : '';
        
        const planName = userPlanName || `扫描扣减 ${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        
        let planItems = [];
        currentScanResults.forEach((qty, code) => {
            planItems.push({ code, qty });
        });
        
        // Capture Thumbnail (reuse logic from createPlan, or simplify)
        let thumbnail = null;
        try {
            const originalImg = document.getElementById('scanPreviewImg');
            if (originalImg && originalImg.src && originalImg.naturalWidth > 0) {
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 const maxDim = 3072; 
                 let w = originalImg.naturalWidth;
                 let h = originalImg.naturalHeight;
                 if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } } 
                 else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
                 canvas.width = w; canvas.height = h;
                 ctx.drawImage(originalImg, 0, 0, w, h);
                 thumbnail = canvas.toDataURL('image/jpeg', 0.92);
            } else if (typeof cropper !== 'undefined' && cropper) {
                thumbnail = cropper.getCroppedCanvas({ maxWidth: 3072, maxHeight: 3072 }).toDataURL('image/jpeg', 0.92);
            }
        } catch(e) { console.error("Thumbnail error", e); }

        const newPlan = {
            id: 'plan_' + Date.now(),
            name: planName,
            createdAt: Date.now(),
            items: planItems,
            status: 'active', // Will be set to completed by deductPlanInventory
            thumbnail: thumbnail
        };

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        plans.unshift(newPlan);
        localStorage.setItem('bead_plans', JSON.stringify(plans));

        // 2. Execute Deduction (inline logic without confirm)
        
        const BEAD_WEIGHT_PER_100 = 1;
        let count = 0;
        
        newPlan.items.forEach(pItem => {
             const item = data.find(d => d.id === pItem.code);
             if(item) {
                 const weightToDeduct = parseFloat((pItem.qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2));
                 item.w = parseFloat((item.w - weightToDeduct).toFixed(2));
                 
                 if (!item.logs) item.logs = [];
                 item.logs.push({
                    d: formatTime(new Date()),
                    type: 'use', 
                    val: weightToDeduct,
                    c: pItem.qty, 
                    desc: `计划扣减: ${newPlan.name}`,
                    drawingName: newPlan.name,
                    planId: newPlan.id
                 });
                 item.totalUsed = parseFloat(((item.totalUsed || 0) + weightToDeduct).toFixed(2));
                 count++;
             }
        });
        
        if (count > 0) {
            save();
            render(); 
        }
        
        // Mark as completed
        newPlan.status = 'completed';
        newPlan.completedAt = Date.now();
        localStorage.setItem('bead_plans', JSON.stringify(plans)); // Save updated status
        
        showToast(`已自动创建计划并扣减 ${count} 个色号库存。`);
        resetScan(); // Auto clear scan page
        navToDock('plan');
        setPlanFilter('completed');
    }

    let currentPlanId = null;
    let isPlanSelectionMode = false;
    let selectedPlanIds = new Set();
    let expandedPlanIds = new Set();
    let expandedPlanColorIds = new Set();
    let longPressTimer = null;
    let currentPlanFilter = 'active';

    function setPlanFilter(status) {
        currentPlanFilter = status;
        
        const activeBtn = document.getElementById('filter-active');
        const completedBtn = document.getElementById('filter-completed');
        
        if(status === 'active') {
            activeBtn.style.background = 'white';
            activeBtn.style.color = '#4a90e2';
            activeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            completedBtn.style.background = 'transparent';
            completedBtn.style.color = '#999';
            completedBtn.style.boxShadow = 'none';
        } else {
            activeBtn.style.background = 'transparent';
            activeBtn.style.color = '#999';
            activeBtn.style.boxShadow = 'none';
            completedBtn.style.background = 'white';
            completedBtn.style.color = '#4a90e2';
            completedBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
        
        renderPlans();
    }

    function renameCurrentPlan() {
        if (!currentPlanId) return;
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(currentPlanId, plans);
        if (!plan) return;

        openRenamePlanModal(plan.name);
    }

    function openRenamePlanModal(currentName) {
        const modal = document.getElementById('renamePlanModal');
        const input = document.getElementById('renamePlanInput');
        if (modal && input) {
            input.value = currentName;
            showModal('renamePlanModal');
            // Delay focus slightly to ensure modal is visible
            setTimeout(() => input.focus(), 100);
        }
    }

    function submitRenamePlan() {
        if (!currentPlanId) return;
        
        const input = document.getElementById('renamePlanInput');
        const newName = input.value.trim();
        
        if (newName) {
            let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
            const plan = findPlanById(currentPlanId, plans);
            
            if (plan) {
                plan.name = newName;
                localStorage.setItem('bead_plans', JSON.stringify(plans));
                
                // Update UI if we are viewing this plan
                const titleEl = document.getElementById('planDetailTitle');
                if (titleEl) titleEl.innerText = plan.name;
                
                renderPlans();
                showToast(`计划重命名为 "${newName}"`);
            }
        }
        closeAllModals();
    }

    function findPlanById(id, list) {
        if (!list) list = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        for (let p of list) {
            if (p.id == id) return p;
            if (p.subPlans) {
                const found = findPlanById(id, p.subPlans);
                if (found) return found;
            }
        }
        return null;
    }

    function aggregateActivePlanRequirements(plans) {
        const requirements = new Map();
        const BEAD_WEIGHT_PER_100 = 1; // 1g per 100 beads

        function processPlan(plan) {
            // If it's a folder, process its sub-plans
            if (plan.subPlans && plan.subPlans.length > 0) {
                // For collections, we check each sub-plan's status independently
                plan.subPlans.forEach(subPlan => {
                    // Only count ACTIVE sub-plans
                    if (subPlan.status === 'active') {
                        processPlan(subPlan);
                    }
                });
            } else if (plan.status === 'active' && plan.items) {
                // If it's a regular active plan, add its items
                plan.items.forEach(item => {
                    const current = requirements.get(item.code) || 0;
                    requirements.set(item.code, current + item.qty);
                });
            }
        }

        // Start processing top-level plans
        plans.forEach(plan => processPlan(plan));

        // Calculate shortages
        const shortages = [];
        requirements.forEach((qty, code) => {
            const bead = data.find(d => d.id === code);
            const currentStock = bead ? (bead.w || 0) : 0;
            // Check if monitoring is disabled (default is true/undefined, explicit false means disabled)
            const isMonitored = bead ? (bead.monitor !== false) : true;
            
            const neededWeight = (qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2);
            
            // Only report shortage if stock is insufficient AND monitoring is enabled
            if (currentStock < neededWeight && isMonitored) {
                shortages.push({
                    code,
                    neededQty: qty,
                    missingQty: Math.ceil((neededWeight - currentStock) * 100) / 100 
                });
                // Recalculate missing weight properly for display
                shortages[shortages.length - 1].missingQty = (neededWeight - currentStock).toFixed(2);
            }
        });

        return { requirements, shortages };
    }

    function renderPlans() {
        const container = document.getElementById('planList');
        if (!container) return;

        // Update Overview Stats if visible
        const overviewEl = document.getElementById('plan-overview-container');
        if (overviewEl && overviewEl.style.display !== 'none') {
            // Use debounce or just call it? calling it directly for now.
            // But we should avoid re-reading LS if possible. 
            // For now, simple implementation.
            updatePlanOverviewStats();
        }

        let plans = [];
        try {
            plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        } catch(e) {
            plans = [];
        }

        // Search
        const searchInput = document.getElementById('planSearch');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        // Calculate counts
        // Helper to count real plans (leaves)
        const getRealCount = (list) => {
            let count = 0;
            list.forEach(p => {
                if (p.subPlans && p.subPlans.length > 0) {
                    count += getRealCount(p.subPlans);
                } else {
                    count++;
                }
            });
            return count;
        };

        const activeList = plans.filter(p => (p.status || 'active') === 'active');
        const completedList = plans.filter(p => (p.status || 'active') === 'completed');

        const activeCount = getRealCount(activeList);
        const completedCount = getRealCount(completedList);
        
        // Update filter buttons text
        const activeBtn = document.getElementById('filter-active');
        const completedBtn = document.getElementById('filter-completed');
        if (activeBtn) activeBtn.innerText = `计划中 (${activeCount})`;
        if (completedBtn) completedBtn.innerText = `已完成 (${completedCount})`;

        // Filter plans based on status (top level only)
        let filtered = plans.filter(p => (p.status || 'active') === currentPlanFilter);

        let isSearchMode = false;
        if (query) {
            isSearchMode = true;
            filtered = filterPlansByQuery(filtered, query);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #999; padding: 40px;">
                    <div style="font-size: 40px; margin-bottom: 10px;">📋</div>
                    ${query ? '未找到匹配的计划' : (currentPlanFilter === 'active' ? '暂无进行中的计划' : '暂无已完成的计划')}
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        // Add Active Plan Summary (New Requirement)
        // Only show summary if NOT searching (to avoid confusion/clutter)
        if (currentPlanFilter === 'active' && !isSearchMode) {
             const summary = aggregateActivePlanRequirements(plans); // We pass all plans, function handles recursion and filtering
             if (summary && summary.requirements.size > 0) {
                 // Render Summary
                 const summaryCard = document.createElement('div');
                 summaryCard.style.cssText = 'background: linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #bae7ff; box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);';
                 
                 let totalQty = 0;
                 summary.requirements.forEach(qty => totalQty += qty);
                 
                 let missingHtml = '';
                 if (summary.shortages.length > 0) {
                     summary.shortages.sort((a, b) => b.missingQty - a.missingQty);
                     const missingItems = summary.shortages.map(item => `
                         <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.8); padding: 4px 8px; border-radius: 6px; border: 1px solid #ffccc7; margin-bottom: 4px;">
                             <span style="font-weight: bold; color: #cf1322;">${item.code}</span>
                             <span style="font-size: 12px; color: #666;">缺 ${item.missingQty}g</span>
                         </div>
                     `).join('');
                     
                     missingHtml = `
                         <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #ffa39e;">
                             <div style="font-size: 13px; font-weight: bold; color: #cf1322; margin-bottom: 8px; display: flex; align-items: center;">
                                <span style="margin-right: 4px;">⚠️</span> 缺货预警 (${summary.shortages.length} 色)
                                <span onclick="copyMissingSummary()" style="cursor: pointer; color: #cf1322; font-size: 16px; display: flex; align-items: center; padding: 4px; margin-left: 8px;" title="复制缺货清单">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </span>
                            </div>
                             <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px;">
                                 ${missingItems}
                             </div>
                         </div>
                     `;
                 } else {
                     missingHtml = `
                         <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #bae7ff; color: #52c41a; font-size: 13px; font-weight: bold;">
                             ✅ 库存充足，无缺货色号
                         </div>
                     `;
                 }
                 
                 summaryCard.innerHTML = `
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                         <div style="font-weight: bold; font-size: 16px; color: #0050b3;">📊 计划总览</div>
                         <div style="font-size: 12px; color: #69c0ff;">共 ${summary.requirements.size} 色 / ${totalQty} 颗</div>
                     </div>
                     ${missingHtml}
                 `;
                 container.appendChild(summaryCard);
             }
        }
        renderPlanList(filtered, container, isSearchMode);
    }

    function filterPlansByQuery(list, query) {
        let result = [];
        list.forEach(p => {
            const matchName = p.name && p.name.toLowerCase().includes(query);
            let matchChildren = false;
            let filteredSubPlans = [];
            
            if (p.subPlans && p.subPlans.length > 0) {
                filteredSubPlans = filterPlansByQuery(p.subPlans, query);
                if (filteredSubPlans.length > 0) {
                    matchChildren = true;
                }
            }
            
            if (matchChildren) {
                 const newPlan = {...p};
                 newPlan.subPlans = filteredSubPlans;
                 result.push(newPlan);
            } else if (matchName) {
                 const newPlan = {...p};
                 newPlan.subPlans = p.subPlans; // Keep original structure if parent matches
                 result.push(newPlan);
            }
        });
        return result;
    }

    function renderPlanList(list, container, forceExpand = false) {
        list.forEach(plan => {
            container.appendChild(createPlanCardElement(plan, false, forceExpand));
            
            // Render children if expanded
            if (plan.subPlans && plan.subPlans.length > 0 && (expandedPlanIds.has(plan.id) || forceExpand)) {
                const childContainer = document.createElement('div');
                childContainer.style.cssText = 'margin-left: 20px; padding-left: 10px; border-left: 2px solid #eee; margin-bottom: 15px;';
                
                renderPlanList(plan.subPlans, childContainer, forceExpand);
                container.appendChild(childContainer);
            }
        });
    }

    let currentSwipedPlanId = null;

    function createPlanCardElement(plan, isChild, forceExpand = false) {
        const items = plan.items || [];
        const date = new Date(plan.createdAt);
        const dateStr = `创建: ${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
        
        let completedDateStr = '';
        if (plan.status === 'completed' && plan.completedAt) {
            const cDate = new Date(plan.completedAt);
            completedDateStr = `完成: ${cDate.getFullYear()}/${cDate.getMonth()+1}/${cDate.getDate()}`;
        }
        
        const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
        const totalCodes = items.length;
        const isFolder = plan.subPlans && plan.subPlans.length > 0;

        // Check parent for Move Out button
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const parent = findParent(plan.id, plans, null);
        const hasParent = !!parent;

        const card = document.createElement('div');
        card.className = 'plan-card';
        // Wrapper style: relative, overflow hidden for swipe
        card.style.cssText = 'background: transparent; margin-bottom: 12px; position: relative; overflow: hidden; height: auto; border-radius: 12px;';
        
        // --- Define Swipe Actions ---
        const actions = [];
        
        // 1. Withdraw (Only if completed)
        if (plan.status === 'completed') {
            actions.push({
                text: '撤回',
                bg: '#ff9800',
                click: (e) => { e.stopPropagation(); revertPlanToActive(plan.id); resetSwipe(); }
            });
        }
        
        // 2. Move Out (Only if has parent)
        if (hasParent) {
            actions.push({
                text: '移出',
                bg: '#fa8c16',
                click: (e) => { e.stopPropagation(); movePlanOut(plan.id); resetSwipe(); }
            });
        }
        
        // 3. Copy (Only if NOT completed)
        if (plan.status !== 'completed') {
            actions.push({
                text: '复制',
                bg: '#1890ff',
                click: (e) => { e.stopPropagation(); duplicatePlan(plan.id); resetSwipe(); }
            });
        }
        
        // 4. Delete (Only if NOT completed)
        if (plan.status !== 'completed') {
            actions.push({
                text: '删除',
                bg: '#ff4d4f',
                click: (e) => { e.stopPropagation(); deletePlan(plan.id); resetSwipe(); }
            });
        }

        const actionBtnWidth = 64;
        const totalActionWidth = actions.length * actionBtnWidth;

        // Actions HTML
        let actionsHtml = actions.map(action => `
            <div class="swipe-action-btn" style="
                width: ${actionBtnWidth}px; 
                height: 100%; 
                background: ${action.bg}; 
                color: white; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
            ">
                ${action.text}
            </div>
        `).join('');
        
        // Add Actions Container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'plan-card-actions';
        actionsContainer.style.cssText = 'position: absolute; top: 0; right: 0; bottom: 0; display: flex; z-index: 1; border-radius: 0 12px 12px 0; overflow: hidden;';
        actionsContainer.innerHTML = actionsHtml;
        
        // Bind Action Clicks
        const actionBtns = actionsContainer.querySelectorAll('.swipe-action-btn');
        actionBtns.forEach((btn, index) => {
            btn.onclick = actions[index].click;
        });
        card.appendChild(actionsContainer);

        // --- Card Inner Content (Visible Part) ---
        const innerEl = document.createElement('div');
        innerEl.className = 'plan-card-inner';
        innerEl.style.cssText = 'background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; z-index: 2; transition: transform 0.2s ease-out; border: 1px solid #f0f0f0; width: 100%; box-sizing: border-box; display: flex; align-items: stretch;';
        
        // --- Selection Mode Logic ---
        if (isPlanSelectionMode && selectedPlanIds.has(plan.id)) {
            innerEl.classList.add('selected');
            innerEl.style.background = '#f0f7ff';
            innerEl.style.borderColor = '#4a90e2';
            innerEl.style.boxShadow = '0 0 0 2px #4a90e2';
        }
        
        // Icon Logic
        let iconHtml = '';
        if (plan.thumbnail) {
             iconHtml = `<img src="${plan.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (isFolder) {
             iconHtml = `<div style="font-size: 20px;">📂</div>`;
        } else {
             iconHtml = `<div style="font-size: 20px;">📅</div>`;
        }
        
        const iconContainerStyle = plan.thumbnail 
            ? "width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 1px solid #eee; margin-right: 12px; flex-shrink: 0;"
            : "width: 40px; height: 40px; background: #f9f0ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;";

        const iconContainerHtml = `<div style="${iconContainerStyle}">${iconHtml}</div>`;

        // Color List Logic
        let itemsHtml = '';
        const sortedItems = [...items].sort((a, b) => b.qty - a.qty);
        const previewLimit = 7;
        const visibleItems = sortedItems.slice(0, previewLimit);
        const remainingCount = Math.max(0, sortedItems.length - previewLimit);

        visibleItems.forEach(item => {
            itemsHtml += `
                <div style="
                    background: #fff7e6; 
                    color: #d46b08;
                    border-radius: 4px; 
                    padding: 2px 6px;
                    font-size: 11px; 
                    font-weight: 500;
                    white-space: nowrap;
                ">
                    ${item.code}
                </div>
            `;
        });
        
        if (remainingCount > 0) {
            itemsHtml += `<div style="font-size: 11px; color: #999; padding: 2px 4px;">+${remainingCount}</div>`;
        }

        const checkboxHtml = ''; 

        // Action Button (Play/Complete)
        let actionBtnHtml = '';
        if (plan.status === 'active' && !isPlanSelectionMode) {
             actionBtnHtml = `
                <div class="action-play-btn" onclick="event.stopPropagation(); deductPlanInventory('${plan.id}')" style="
                    width: 28px; height: 28px; 
                    background: #52c41a; 
                    border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    color: white; 
                    cursor: pointer; 
                    box-shadow: 0 2px 6px rgba(82, 196, 26, 0.3);
                ">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
             `;
        } else if (plan.status === 'completed' && !isPlanSelectionMode) {
             actionBtnHtml = `
                <div style="
                    width: 28px; height: 28px; 
                    background: #f6ffed; 
                    border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    color: #52c41a; 
                    border: 1px solid #b7eb8f;
                ">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
             `;
        }

        // Folder Expand Logic
        let folderExpandHtml = '';
        if (isFolder) {
            const isExpanded = expandedPlanIds.has(plan.id) || forceExpand;
            folderExpandHtml = `
                <div class="expand-btn-wrapper" onclick="event.stopPropagation(); toggleFolder('${plan.id}')" style="
                    padding: 4px;
                    margin-right: 12px;
                    flex-shrink: 0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                ">
                    <div style="
                        transform: rotate(${isExpanded ? '90deg' : '0deg'});
                        transition: transform 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 20px;
                        height: 20px;
                        color: #ccc;
                    ">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                </div>
            `;
        }
        
        let folderTagHtml = '';
        if (isFolder) {
            folderTagHtml = `
                <div style="
                    background: #e6f7ff; 
                    color: #1890ff; 
                    font-size: 11px; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    margin-right: 10px;
                    display: inline-block;
                    font-weight: 500;
                ">
                    ${plan.subPlans.length}个
                </div>
            `;
        }

        const statsHtml = `
            <div style="display: flex; align-items: center; gap: 15px; font-size: 12px; color: #666;">
                ${folderTagHtml}
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 14px; opacity: 0.7;">🎨</span> 
                    <span style="font-weight: 500;">${totalCodes} 色</span>
                </div>
                ${!isFolder ? `
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 14px; opacity: 0.7;">🔢</span> 
                    <span style="font-weight: 500;">${totalQty.toLocaleString()} 颗</span>
                </div>` : ''}
            </div>
        `;

        const arrowHtml = `
            <div style="color: #ccc; margin-left: 4px;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;

        innerEl.innerHTML = `
            <div style="display: flex; align-items: stretch; width: 100%;">
                ${folderExpandHtml}
                ${checkboxHtml}
                
                <div style="flex: 1; overflow: hidden; padding-right: 8px;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        ${iconContainerHtml}
                        <div style="font-weight: bold; font-size: 16px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${plan.name}
                        </div>
                    </div>

                    <div style="margin-bottom: ${!isFolder && visibleItems.length > 0 ? '8px' : '0'};">
                        ${statsHtml}
                    </div>
                    
                    ${!isFolder && visibleItems.length > 0 ? `
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">
                        ${itemsHtml}
                    </div>
                    ` : ''}
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; padding-left: 10px;">
                    <div style="font-size: 11px; color: #999; white-space: nowrap; margin-bottom: 8px; text-align: right;">
                        <div>${dateStr}</div>
                        ${completedDateStr ? `<div style="margin-bottom: 2px;">${completedDateStr}</div>` : ''}
                        ${(plan.status === 'completed' && (plan.timeSpent || isFolder)) ? (() => {
                             // Correct logic for displaying time on CARD:
                             // If folder, calculate sum of subplans recursively
                             // If normal plan, use timeSpent directly
                             let displayTime = plan.timeSpent;
                             
                             if (isFolder && plan.subPlans && plan.subPlans.length > 0) {
                                let totalMin = 0;
                                const sumTime = (p) => {
                                    if (p.timeSpent) {
                                        let h = 0, m = 0;
                                        let hMatch = p.timeSpent.match(/(\d+)h/);
                                        let mMatch = p.timeSpent.match(/(\d+)m/);
                                        if (!hMatch) hMatch = p.timeSpent.match(/(\d+)小时/);
                                        if (!mMatch) mMatch = p.timeSpent.match(/(\d+)分钟/);
                                        if (hMatch) h = parseInt(hMatch[1]);
                                        if (mMatch) m = parseInt(mMatch[1]);
                                        totalMin += h * 60 + m;
                                    }
                                    if (p.subPlans) p.subPlans.forEach(sumTime);
                                };
                                
                                // FIX: Don't sum the folder itself recursively if it's already included in the initial call
                                // sumTime(plan) calls p.subPlans.forEach(sumTime), which is correct.
                                // BUT, 'plan' itself might have 'timeSpent' (residue from before it was a folder, or set incorrectly).
                                // We should ignore the folder's OWN timeSpent if we are aggregating subplans, 
                                // OR we should treat the folder as just a container.
                                // The issue "8h vs 16h" suggests double counting or partial counting.
                                // If "ces" has timeSpent="8h" AND has subplans with 6h+2h=8h.
                                // sumTime(plan) -> adds plan.timeSpent(8h) -> recurses subplans(6h+2h) -> total 16h.
                                // FIX: Pass subPlans to sumTime, don't pass 'plan' itself to avoid counting the container's residue time.
                                
                                plan.subPlans.forEach(sumTime);
                                
                                if (totalMin > 0) {
                                    const h = Math.floor(totalMin / 60);
                                    const m = totalMin % 60;
                                    displayTime = '';
                                    if (h > 0) displayTime += `${h}h `;
                                    if (m > 0) displayTime += `${m}m`;
                                    displayTime = displayTime.trim();
                                } else {
                                    displayTime = null;
                                }
                             }
                             
                             return displayTime ? `<div style="margin-bottom: 2px; color: #8c8c8c;">⌛ ${displayTime}</div>` : '';
                        })() : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                         ${actionBtnHtml}
                         ${arrowHtml}
                    </div>
                </div>
            </div>
        `;
        
        card.appendChild(innerEl);

        // --- Swipe Logic ---
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isSwiping = false;
        let isOpened = false;
        let isMouseDown = false; // Add mouse support
        
        const resetSwipe = () => {
             innerEl.style.transform = `translateX(0)`;
             isOpened = false;
             if (currentSwipedPlanId === plan.id) currentSwipedPlanId = null;
        };

        // Long Press Logic Helpers
        let longPressTimer;
        const startHandler = (e) => {
            if(isOpened) return;
            longPressTimer = setTimeout(() => {
                enterPlanSelectionMode(plan.id);
            }, 800);
        };
        const endHandler = (e) => {
            // For move events, only cancel if moved significantly
            if (e.type === 'touchmove' || e.type === 'mousemove') {
                const cx = e.touches ? e.touches[0].clientX : e.clientX;
                const cy = e.touches ? e.touches[0].clientY : e.clientY;
                if (Math.abs(cx - startX) < 5 && Math.abs(cy - startY) < 5) {
                    return; // Ignore small jitter
                }
            }
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        
        if (!isPlanSelectionMode) {
            // 1. Touch Events (Mobile)
            innerEl.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                currentX = startX;
                isSwiping = false;
                
                // Close other opened card
                if (currentSwipedPlanId && currentSwipedPlanId !== plan.id) {
                     // Global reset via ID check in other components if implemented, 
                     // or just rely on user tapping the other one to close.
                }
                
                startHandler(e); // Start Long Press
            }, {passive: true});

            innerEl.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;
                let deltaX = currentX - startX;
                const deltaY = currentY - startY;

                // Lock horizontal scroll if vertical movement is dominant
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    endHandler(e); // Cancel long press if scrolling vertically
                    return;
                }
                
                // If already opened, start from offset
                if (isOpened) {
                    deltaX -= totalActionWidth;
                }
                
                // Limit swipe range
                if (deltaX > 0) deltaX = 0; 
                if (deltaX < -totalActionWidth - 30) deltaX = -totalActionWidth - 30;
                
                if (Math.abs(deltaX) > 5) isSwiping = true;
                
                innerEl.style.transform = `translateX(${deltaX}px)`;
                
                endHandler(e); // Cancel long press if swiping
            }, {passive: true});

            innerEl.addEventListener('touchend', (e) => {
                const deltaX = currentX - startX;
                const threshold = totalActionWidth / 3;
                
                if (isOpened) {
                    if (deltaX > threshold) { // Swipe Right to close
                         resetSwipe();
                    } else {
                         innerEl.style.transform = `translateX(-${totalActionWidth}px)`;
                    }
                } else {
                    if (deltaX < -threshold) { // Swipe Left to open
                         innerEl.style.transform = `translateX(-${totalActionWidth}px)`;
                         isOpened = true;
                         currentSwipedPlanId = plan.id;
                    } else {
                         resetSwipe();
                    }
                }
                
                endHandler(e); // Clear long press
            });
            
            // 2. Mouse Events (Desktop)
            innerEl.addEventListener('mousedown', (e) => {
                startX = e.clientX;
                startY = e.clientY;
                currentX = startX;
                isMouseDown = true;
                isSwiping = false;
                
                startHandler(e); // Start Long Press (Desktop support)
            });
            
            innerEl.addEventListener('mousemove', (e) => {
                if (!isMouseDown) return;
                
                currentX = e.clientX;
                const currentY = e.clientY;
                let deltaX = currentX - startX;
                const deltaY = currentY - startY;

                // Lock horizontal
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    endHandler(e);
                    return;
                }
                
                e.preventDefault(); // Prevent text selection on drag
                
                if (isOpened) {
                    deltaX -= totalActionWidth;
                }
                
                if (deltaX > 0) deltaX = 0; 
                if (deltaX < -totalActionWidth - 30) deltaX = -totalActionWidth - 30;
                
                if (Math.abs(deltaX) > 5) isSwiping = true;
                
                innerEl.style.transform = `translateX(${deltaX}px)`;
                
                endHandler(e);
            });
            
            innerEl.addEventListener('mouseup', (e) => {
                if (!isMouseDown) return;
                isMouseDown = false;
                
                const deltaX = currentX - startX;
                const threshold = totalActionWidth / 3;
                
                if (isOpened) {
                    if (deltaX > threshold) { 
                         resetSwipe();
                    } else {
                         innerEl.style.transform = `translateX(-${totalActionWidth}px)`;
                    }
                } else {
                    if (deltaX < -threshold) { 
                         innerEl.style.transform = `translateX(-${totalActionWidth}px)`;
                         isOpened = true;
                         currentSwipedPlanId = plan.id;
                    } else {
                         resetSwipe();
                    }
                }
                
                endHandler(e);
            });
            
            innerEl.addEventListener('mouseleave', (e) => {
                if (isMouseDown) {
                    isMouseDown = false;
                    resetSwipe();
                    endHandler(e);
                }
            });

            // Click Logic
            innerEl.onclick = (e) => {
                if (isSwiping) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (isOpened) {
                    resetSwipe();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (e.target.closest('.expand-btn')) return;
                if (e.target.closest('.action-play-btn')) return;
                
                viewPlanDetail(plan.id);
            };
        } else {
             innerEl.onclick = () => togglePlanSelection(plan.id);
        }

        return card;
    }

    function toggleFolder(id) {
        if (expandedPlanIds.has(id)) {
            expandedPlanIds.delete(id);
        } else {
            expandedPlanIds.add(id);
        }
        renderPlans();
    }

    function togglePlanColor(id) {
        if (expandedPlanColorIds.has(id)) {
            expandedPlanColorIds.delete(id);
        } else {
            expandedPlanColorIds.add(id);
        }
        renderPlans();
    }

    function findParent(id, list, parent) {
        if (!list) return null;
        for (let p of list) {
            if (p.id === id) return parent;
            if (p.subPlans && p.subPlans.length > 0) {
                const found = findParent(id, p.subPlans, p);
                if (found) return found;
            }
        }
        return null;
    }

    function movePlanOut(id) {
        if (!id) return;
        currentMoveOutPlanId = id;
        showModal('moveOutConfirmModal');
    }

    function confirmMoveOutPlan() {
        if (!currentMoveOutPlanId) return;
        const id = currentMoveOutPlanId;
        closeAllModals();

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const parent = findParent(id, plans, null);
        
        if (!parent) {
            alert('未找到父文件夹，无法移出。');
            return;
        }

        const idx = parent.subPlans.findIndex(p => p.id === id);
        if (idx === -1) return;
        
        const [planToMove] = parent.subPlans.splice(idx, 1);
        
        if (parent.subPlans.length === 0) {
            deletePlanRecursive(plans, parent.id);
        } else {
            recalculatePlanItems(parent);
        }
        
        plans.unshift(planToMove);
        localStorage.setItem('bead_plans', JSON.stringify(plans));
        
        showToast('计划已移出文件夹');
        renderPlans();
        currentMoveOutPlanId = null;
    }

    let currentPlanDetailSort = 'qty';

    function togglePlanDetailSort() {
        currentPlanDetailSort = (currentPlanDetailSort === 'qty') ? 'code' : 'qty';
        renderPlanDetailList();
    }

    function renderPlanDetailList() {
        if (!currentPlanId) return;
        const plan = findPlanById(currentPlanId);
        if (!plan) return;

        // Update Sort Button Text
        const sortBtn = document.getElementById('planDetailSortBtn');
        if (sortBtn) {
            sortBtn.innerText = currentPlanDetailSort === 'qty' ? '按用量 ↓' : '按色号 ↑';
        }

        const listContainer = document.getElementById('planDetailList');
        listContainer.innerHTML = '';

        let sortedItems = [...plan.items];
        if (currentPlanDetailSort === 'qty') {
            sortedItems.sort((a, b) => b.qty - a.qty);
        } else {
            // Natural sort for codes
            sortedItems.sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true, sensitivity: 'base'}));
        }

        sortedItems.forEach(item => {
             const bead = data.find(d => d.id === item.code);
             const hex = bead ? bead.hex : '#eee';
             const isUnknown = !bead;
             
             const row = document.createElement('div');
             row.style.cssText = 'background: white; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';
             
             if (isUnknown) {
                 row.style.borderLeft = '4px solid #fa8c16';
                 row.style.background = '#fff7e6';
             }

             row.innerHTML = `
                <div onclick="editPlanItemColor('${item.code}')" style="width: 36px; height: 36px; background: ${hex}; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); cursor: pointer; position: relative;">
                     <div style="position:absolute; right:-2px; bottom:-2px; background:white; border-radius:50%; width:12px; height:12px; display:flex; align-items:center; justify-content:center; border:1px solid #ddd;">
                         <span style="font-size:8px; color:#666;">▼</span>
                     </div>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 16px; color: #333;">
                        ${item.code}
                        ${isUnknown ? '<span style="font-size:10px; background:#fa8c16; color:white; padding:2px 4px; border-radius:4px; margin-left:5px; vertical-align:middle;">系统无此色号</span>' : ''}
                    </div>
                    ${isUnknown ? '<div style="font-size: 12px; color: #fa8c16; margin-top: 4px;">请确认色号是否正确</div>' : ''}
                </div>
                <div style="text-align: right;" onclick="editPlanItemQty('${item.code}')">
                    <div style="font-weight: bold; font-size: 18px; color: #333; cursor: pointer; border-bottom: 1px dashed #ccc; display: inline-block;">${item.qty}</div>
                    <div style="font-size: 10px; color: #ccc;">粒 ✎</div>
                </div>
                <div onclick="deletePlanDetailItem('${item.code}')" style="margin-left: 10px; padding: 5px; color: #999; font-size: 20px; cursor: pointer;">×</div>
             `;
             listContainer.appendChild(row);
        });
    }

    function deletePlanDetailItem(code) {
        if (!currentPlanId) return;
        
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        // Use the global/helper findPlanById. 
        // Note: findPlanById definition must support (id, list). 
        // Based on existing code 'deletePlan(id)', it does.
        const plan = findPlanById(currentPlanId, plans);
        
        if (!plan) return;
        
        showConfirmModal(
            "删除确认",
            `确定要从计划中删除色号 ${code} 吗？`,
            () => {
                const idx = plan.items.findIndex(i => i.code === code);
                if (idx !== -1) {
                    plan.items.splice(idx, 1);
                    
                    // If plan is part of a collection, we might need to update parent stats?
                    // The current implementation seems to calculate items on the fly for rendering,
                    // but for collections 'items' are usually aggregated?
                    // If this is a leaf plan, just saving is enough.
                    // If this is a collection, we shouldn't be editing items directly usually (items are computed).
                    // But if 'items' exists on it, we edit it.
                    
                    localStorage.setItem('bead_plans', JSON.stringify(plans));
                    
                    // Refresh View
                    renderPlanDetailList();
                    showToast('已删除色号 ' + code);
                    
                    // Also update main list if visible
                    renderPlans();
                }
            }
        );
    }


    let currentPlanEditCode = null;

    // --- Plan Detail Edit Qty ---
    function editPlanItemQty(code) {
        if (!currentPlanId) return;
        const plan = findPlanById(currentPlanId);
        if (!plan) return;

        const item = plan.items.find(i => i.code === code);
        if (!item) return;

        currentPlanEditCode = code;
        document.getElementById('planDetailQtyCode').innerText = code;
        document.getElementById('planDetailQtyInput').value = item.qty;
        showModal('planDetailQtyModal');
    }

    function adjustPlanItemQty(delta) {
        const input = document.getElementById('planDetailQtyInput');
        let val = parseInt(input.value) || 0;
        val += delta;
        if (val < 0) val = 0;
        input.value = val;
    }

    function submitPlanItemQty() {
        if (!currentPlanId || !currentPlanEditCode) return;
        
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(currentPlanId, plans);
        if (!plan) return;

        const item = plan.items.find(i => i.code === currentPlanEditCode);
        if (item) {
            const input = document.getElementById('planDetailQtyInput');
            const val = parseInt(input.value);
            if (!isNaN(val) && val >= 0) {
                item.qty = val;
                localStorage.setItem('bead_plans', JSON.stringify(plans));
                renderPlanDetailList();
                closeAllModals();
                showToast(`已更新色号 ${currentPlanEditCode} 用量`);
                
                // Update stats
                const totalQty = plan.items.reduce((sum, item) => sum + item.qty, 0);
                document.getElementById('planDetailBeadCount').innerText = totalQty.toLocaleString();
            } else {
                showToast("请输入有效的数量");
            }
        }
    }

    // --- Plan Detail Edit Color ---
    function editPlanItemColor(code) {
        currentPlanEditCode = code;
        document.getElementById('planDetailColorSearch').value = '';
        renderPlanDetailColorList('');
        showModal('planDetailColorModal');
        setTimeout(() => document.getElementById('planDetailColorSearch').focus(), 100);
    }

    function filterPlanDetailColorList() {
        const filter = document.getElementById('planDetailColorSearch').value;
        renderPlanDetailColorList(filter);
    }

    function renderPlanDetailColorList(filter) {
        const container = document.getElementById('planDetailColorList');
        container.innerHTML = '';
        
        const filterText = filter.toUpperCase();
        const filtered = data.filter(d => d.id.toUpperCase().includes(filterText));
        const displayList = (filterText === '' ? filtered.slice(0, 50) : filtered);
        
        if (displayList.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">无匹配色号</div>';
            return;
        }

        displayList.forEach(item => {
            const isCurrent = item.id === currentPlanEditCode;
            const div = document.createElement('div');
            div.style.cssText = `display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee; background:${isCurrent ? '#e6f7ff' : 'white'}; cursor:pointer; border-radius:8px; margin-bottom:5px;`;
            div.onclick = () => selectPlanDetailColor(item.id);
            
            div.innerHTML = `
                <div style="width:30px; height:30px; background:${item.hex}; border-radius:50%; border:1px solid #ddd; margin-right:15px;"></div>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#333;">${item.id}</div>
                    <div style="font-size:12px; color:#999;">库存: ${item.w || 0}g</div>
                </div>
                ${isCurrent ? '<span style="color:#1890ff; font-weight:bold;">当前</span>' : ''}
            `;
            container.appendChild(div);
        });
        
        if (filterText === '' && data.length > 50) {
            const more = document.createElement('div');
            more.style.cssText = 'text-align:center; padding:10px; color:#999; font-size:12px;';
            more.innerText = `显示前 50 个结果 (共 ${data.length} 个)，请输入搜索词查找`;
            container.appendChild(more);
        }
    }

    function selectPlanDetailColor(newCode) {
        if (!currentPlanId || !currentPlanEditCode) return;
        if (currentPlanEditCode === newCode) {
            closeAllModals();
            return;
        }

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(currentPlanId, plans);
        if (!plan) return;

        // Check if new code exists in plan
        const existingItem = plan.items.find(i => i.code === newCode);
        const currentItem = plan.items.find(i => i.code === currentPlanEditCode);
        
        if (!currentItem) return;

        if (existingItem) {
            // Merge
            if(confirm(`色号 ${newCode} 已在计划中 (数量: ${existingItem.qty})。是否合并数量？`)) {
                existingItem.qty += currentItem.qty;
                // Remove old item
                const idx = plan.items.indexOf(currentItem);
                plan.items.splice(idx, 1);
            } else {
                return;
            }
        } else {
            // Update code
            currentItem.code = newCode;
        }

        localStorage.setItem('bead_plans', JSON.stringify(plans));
        renderPlanDetailList();
        closeAllModals();
        showToast(`已修改色号为 ${newCode}`);
        
        // Update stats
        document.getElementById('planDetailColorCount').innerText = plan.items.length;
    }



    function viewPlanDetail(id) {
        const plan = findPlanById(id);
        if(!plan) return;

        currentPlanId = id;

        const titleEl = document.getElementById('planDetailTitle');
        titleEl.innerText = plan.name;
        
        // Setup Image Preview
        const imgContainer = document.getElementById('planDetailImageContainer');
        const imgEl = document.getElementById('planDetailImage');
        if (plan.thumbnail) {
            imgEl.src = plan.thumbnail;
            imgContainer.style.display = 'block';
        } else {
            imgContainer.style.display = 'none';
        }
        
        // Check for parent and show Move Out button
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const parentPlan = findParent(id, plans, null);
        
        // Update Status Banner
        const statusBanner = document.getElementById('planDetailStatus');
        const actionButtons = document.getElementById('planDetailActions');
        
        // Clear previous buttons
        const revertBtnId = 'btn-revert-active';
        const existingRevertBtn = document.getElementById(revertBtnId);
        if(existingRevertBtn) existingRevertBtn.remove();
        
        const duplicateBtnId = 'btn-duplicate-plan';
        const existingDupBtn = document.getElementById(duplicateBtnId);
        if(existingDupBtn) existingDupBtn.remove();

        if (plan.status === 'completed') {
            // Clear status banner first
            statusBanner.innerHTML = '';
            statusBanner.style.background = '#f6ffed';
            statusBanner.style.color = '#52c41a';

            // 1. Status Text
            const statusText = document.createElement('div');
            statusText.style.fontWeight = 'bold';
            statusText.style.fontSize = '16px';
            statusText.innerText = '✅ 已完成 - 库存已扣减';
            statusBanner.appendChild(statusText);

            // 2. Completed Time
            if (plan.completedAt) {
                const timeDiv = document.createElement('div');
                timeDiv.style.fontSize = '13px';
                timeDiv.style.marginTop = '6px';
                timeDiv.style.opacity = '0.8';
                timeDiv.innerText = '完成于: ' + formatTime(new Date(plan.completedAt));
                statusBanner.appendChild(timeDiv);
            }
            
            // 3. Edit Time Button (Created via DOM to ensure events work)
            const editBtn = document.createElement('button');
            // High z-index to ensure it's on top
            editBtn.style.cssText = "display:flex; align-items:center; gap:5px; margin-top:8px; padding:6px 10px; border:none; border-radius:6px; width:fit-content; cursor:pointer; user-select:none; position: relative; z-index: 2000; pointer-events: auto; font-family: inherit;";
            
            // Calculate aggregated time spent for display if not set directly
            // If plan has no timeSpent but has subPlans, sum them up
            let displayTime = plan.timeSpent;
            let isAggregated = false;
            
            // Determine if it is an aggregated plan (Collection)
            // It is aggregated if it has subPlans AND (it has no direct timeSpent OR we want to force aggregation for collections)
            // Requirement: "Completed collection plan time is sum of subplans, cannot be modified."
            // So if subPlans exist, we treat it as aggregated for time calculation purposes, ignoring any potential direct timeSpent residue.
            if (plan.subPlans && plan.subPlans.length > 0) {
                let totalMin = 0;
                const sumTime = (p) => {
                    if (p.timeSpent) {
                        let h = 0, m = 0;
                        let hMatch = p.timeSpent.match(/(\d+)h/);
                        let mMatch = p.timeSpent.match(/(\d+)m/);
                        if (!hMatch) hMatch = p.timeSpent.match(/(\d+)小时/);
                        if (!mMatch) mMatch = p.timeSpent.match(/(\d+)分钟/);
                        if (hMatch) h = parseInt(hMatch[1]);
                        if (mMatch) m = parseInt(mMatch[1]);
                        totalMin += h * 60 + m;
                    }
                    if (p.subPlans) p.subPlans.forEach(sumTime);
                };
                sumTime(plan); // Keep original logic but modify sumTime internal if needed OR fix recursion
                // Current logic: sumTime(plan) adds plan.timeSpent THEN recurses subPlans.
                // For a collection, we ONLY want subPlans.
                // FIX:
                totalMin = 0; // Reset
                if (plan.subPlans) plan.subPlans.forEach(sumTime); // Only recurse children, ignore parent's own timeSpent field which might be stale or duplicate
                
                if (totalMin > 0) {
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    displayTime = '';
                    if (h > 0) displayTime += `${h}h `;
                    if (m > 0) displayTime += `${m}m`;
                    displayTime = displayTime.trim();
                } else {
                    displayTime = '0m'; // Aggregated but 0
                }
                isAggregated = true;
            }

            if (displayTime) {
                 editBtn.style.background = "rgba(82, 196, 26, 0.1)";
                 // If aggregated, show lock icon instead of pencil
                 const icon = isAggregated ? '🔒' : '✏️';
                 editBtn.innerHTML = `
                    <span style="font-size:14px;">⌛</span>
                    <span style="font-weight:500; color: #000;">${displayTime}</span>
                    <span style="font-size:12px; color:#52c41a; margin-left:4px; opacity: 0.8;">${icon}</span>`;
            } else {
                 if (isAggregated) {
                     // Aggregated but no time (0m)
                     editBtn.style.background = "rgba(82, 196, 26, 0.1)";
                     editBtn.innerHTML = `
                        <span style="font-size:14px;">⌛</span>
                        <span style="font-weight:500; color: #000;">0m</span>
                        <span style="font-size:12px; color:#52c41a; margin-left:4px; opacity: 0.8;">🔒</span>`;
                 } else {
                     editBtn.style.background = "rgba(24, 144, 255, 0.1)";
                     editBtn.innerHTML = `
                        <span style="font-size:14px;">⌛</span>
                        <span style="color:#1890ff; font-weight:500; font-size:13px;">添加耗时</span>
                        <span style="font-size:12px; color:#1890ff; margin-left:4px; opacity: 0.8;">✏️</span>`;
                 }
            }

            // Robust Event Binding
            if (isAggregated) {
                // If aggregated, click shows explanation toast instead of edit modal
                editBtn.onclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    showToast('这是合集计划，耗时由子计划自动累加');
                };
                editBtn.ontouchstart = function(e) { e.stopPropagation(); }; // Prevent ghost clicks
            } else {
                // Normal editable plan
                editBtn.setAttribute('onclick', `event.stopPropagation(); console.log('Edit clicked for ${plan.id}'); if(window.showEditTimeModal) { window.showEditTimeModal('${plan.id}'); } else { alert('Function not found'); }`);
                
                // Add touchend for better mobile response (fast tap)
                editBtn.addEventListener('touchend', function(e) {
                    e.preventDefault(); 
                    e.stopPropagation();
                    if(window.showEditTimeModal) window.showEditTimeModal(plan.id);
                }, { passive: false });
            }

            statusBanner.appendChild(editBtn);

            if(actionButtons) actionButtons.style.display = 'none';
            

            
        } else {
            statusBanner.innerHTML = `<div style="font-weight:bold; font-size:16px;">计划中 - 尚未扣减库存</div>`;
            statusBanner.style.background = '#fffbe6';
            statusBanner.style.color = '#fa8c16';
            if(actionButtons) actionButtons.style.display = 'flex';
        }
        
        const totalQty = plan.items.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('planDetailColorCount').innerText = plan.items.length;
        document.getElementById('planDetailBeadCount').innerText = totalQty.toLocaleString();
        
        // Calculate and display cost
        const storedCost = localStorage.getItem('bead_unit_cost');
        const unitCost = storedCost ? parseFloat(storedCost) : 0.1;
        const totalWeight = totalQty / 100; // 100 beads approx 1g (based on BEAD_WEIGHT_PER_100 logic usually 1g=100)
        // Actually code uses BEAD_WEIGHT_PER_100 = 1 (1g per 100 beads).
        // So total weight is totalQty / 100.
        const totalCost = totalWeight * unitCost;
        
        // Create or update cost element
        // FIX: Remove duplicates first to prevent multiple cost cards stacking up
        const existingCostContainers = document.querySelectorAll('[id^="planDetailCostContainer"]');
        existingCostContainers.forEach(el => el.remove());
        
        let costEl = document.getElementById('planDetailCost');
        // Always recreate or re-find after cleanup
        if (true) { // Logic simplified: cleanup and recreate is safer than "if (!costEl)" which failed
            // Insert after the counts row
            const countsRow = document.querySelector('.detail-stats'); 
            
            const statsContainer = document.getElementById('planDetailBeadCount').parentNode.parentNode;
            
            const costContainer = document.createElement('div');
            costContainer.id = 'planDetailCostContainer';
            costContainer.style.cssText = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;";
            
            costContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #fff7e6; color: #fa8c16; display: flex; align-items: center; justify-content: center; font-size: 16px;">💰</div>
                    <div>
                        <div style="font-size: 11px; color: #999;">预计成本</div>
                        <div style="font-size: 15px; font-weight: bold; color: #333;">¥ <span id="planDetailCostValue">0.00</span></div>
                    </div>
                </div>
                <div style="font-size: 11px; color: #ccc;">(基于 ${unitCost}元/g)</div>
            `;
            
            statsContainer.parentNode.insertBefore(costContainer, statsContainer.nextSibling);
            costEl = document.getElementById('planDetailCostValue');
        }
        
        // Update value
        if(costEl) {
             costEl.innerText = totalCost.toFixed(2);
        }


        // Render List using the current sort mode (reset to default or keep?)
        // Let's reset to default 'qty' when opening a plan, or keep previous if we want.
        // User didn't specify, but resetting is safer for "default is by usage".
        currentPlanDetailSort = 'qty'; 
        renderPlanDetailList();

        document.getElementById('page-plan').style.display = 'none';
        document.getElementById('page-plan-detail').style.display = 'block';
        window.scrollTo(0, 0);
    }

    function closePlanDetail() {
        document.getElementById('page-plan-detail').style.display = 'none';
        document.getElementById('page-plan').style.display = 'block';
        currentPlanId = null;
    }

    let stockCheckSortType = 'code';
    let stockCheckPrioritizeMissing = false;

    function toggleStockCheckSort(type) {
        if (stockCheckSortType === type) return;
        stockCheckSortType = type;
        renderStockCheckList();
    }

    function toggleStockCheckMissingPriority() {
        stockCheckPrioritizeMissing = !stockCheckPrioritizeMissing;
        renderStockCheckList();
    }

    function checkPlanStock() {
        if (!currentPlanId) return;
        const plan = findPlanById(currentPlanId);
        if(!plan) return;

        const sheet = document.getElementById('stockCheckSheet');
        const summary = document.getElementById('stockCheckSummary');
        
        // Calculate Summary First
        // Calculate Summary
        let missingCount = 0;
        let totalMissingWeight = 0;
        let totalMissingBeads = 0;
        const BEAD_WEIGHT_PER_100 = 1;

        plan.items.forEach(item => {
             const bead = data.find(d => d.id === item.code);
             const currentStock = bead ? (bead.w || 0) : 0;
             const neededWeight = parseFloat((item.qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2));
             if (currentStock < neededWeight) {
                 missingCount++;
                 totalMissingWeight += (neededWeight - currentStock);
                 
                 // Estimate missing beads based on weight diff
                 // (needed - stock) * 100 / BEAD_WEIGHT_PER_100
                 const missingW = neededWeight - currentStock;
                 totalMissingBeads += Math.ceil(missingW * 100 / BEAD_WEIGHT_PER_100);
             }
        });

        // Updated Summary Style to match Reference Image
        if (missingCount > 0) {
            summary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <div style="font-size: 16px; font-weight: bold; color: #333;">${plan.name || '库存确认'}</div>
                    <div style="color: #ff4d4f; font-weight: bold; font-size: 14px;">⚠️ 缺少 ${missingCount} 色</div>
                </div>
                <div style="color: #fa8c16; font-size: 13px;">⊖ 共缺少 ${totalMissingBeads.toLocaleString()} 颗</div>
            `;
            summary.style.cssText = 'background: #fff; padding: 15px 5px 5px 5px; border-bottom: 1px solid #f0f0f0; margin-bottom: 10px;';
        } else {
            summary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #333;">${plan.name || '库存确认'}</div>
                    <div style="color: #52c41a; font-weight: bold; font-size: 14px;">✔ 库存充足</div>
                </div>
                <div style="color: #999; font-size: 13px; margin-top: 5px;">可以开始制作啦！</div>
            `;
            summary.style.cssText = 'background: #fff; padding: 15px 5px 5px 5px; border-bottom: 1px solid #f0f0f0; margin-bottom: 10px;';
        }

        renderStockCheckList();

        sheet.style.display = 'flex';
        document.getElementById('mask').style.display = 'block';
    }

    function renderStockCheckList() {
        if (!currentPlanId) return;
        const plan = findPlanById(currentPlanId);
        if(!plan) return;

        const list = document.getElementById('stockCheckList');
        list.innerHTML = '';
        const BEAD_WEIGHT_PER_100 = 1;

        // Update Button Styles
        const btnCode = document.getElementById('btn-check-code');
        const btnQty = document.getElementById('btn-check-qty');
        const btnMissing = document.getElementById('btn-check-missing');
        
        if(btnCode && btnQty && btnMissing) {
            const activeStyle = "font-size: 12px; padding: 2px 8px; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; font-weight: bold;";
            const inactiveStyle = "font-size: 12px; padding: 2px 8px; border: 1px solid #ddd; background: #fff; color: #666; border-radius: 4px;";
            
            btnCode.style.cssText = stockCheckSortType === 'code' ? activeStyle : inactiveStyle;
            btnQty.style.cssText = stockCheckSortType === 'qty' ? activeStyle : inactiveStyle;
            btnMissing.style.cssText = stockCheckPrioritizeMissing ? activeStyle : inactiveStyle;
        }

        // Sorting
        let sortedItems = [...plan.items];
        
        // 1. Primary Sort
        if (stockCheckSortType === 'qty') {
            sortedItems.sort((a, b) => b.qty - a.qty);
        } else {
            sortedItems.sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}));
        }

        // 2. Priority Sort
        if (stockCheckPrioritizeMissing) {
            sortedItems.sort((a, b) => {
                 const getShortage = (item) => {
                     const bead = data.find(d => d.id === item.code);
                     const currentStock = bead ? (bead.w || 0) : 0;
                     const neededWeight = parseFloat((item.qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2));
                     return currentStock < neededWeight ? 1 : 0;
                 };
                 return getShortage(b) - getShortage(a); // Missing first
            });
        }

        sortedItems.forEach(item => {
             const bead = data.find(d => d.id === item.code);
             const currentStock = bead ? (bead.w || 0) : 0;
             const neededWeight = parseFloat((item.qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2));
             const isMissing = currentStock < neededWeight;
             
             const hex = bead ? bead.hex : '#eee';
             const row = document.createElement('div');
             row.style.cssText = 'display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #f0f0f0; background: white; margin-bottom: 8px; border-radius: 8px;';
             
             // Calculate Bead Counts for Display
             // currentStock (g) -> beads?  (currentStock / BEAD_WEIGHT_PER_100 * 100)
             const currentBeads = Math.floor(currentStock / BEAD_WEIGHT_PER_100 * 100);
             const missingBeads = Math.ceil((neededWeight - currentStock) * 100 / BEAD_WEIGHT_PER_100);

             let rightContent = '';
             if (isMissing) {
                 rightContent = `
                    <div style="text-align: right;">
                        <div style="color: #ff4d4f; font-weight: bold; font-size: 16px;">-${missingBeads.toLocaleString()}</div>
                        <button onclick="showSubstituteModal('${item.code}', ${neededWeight}, ${missingBeads})" style="margin-top:4px; font-size:10px; padding:2px 6px; background:#fff1f0; border:1px solid #ffa39e; color:#cf1322; border-radius:4px; cursor:pointer;">🔍找替补</button>
                    </div>
                 `;
             } else {
                 // Optionally show remaining surplus or just a check? Reference image doesn't show "sufficient" rows clearly but implies checks.
                 // Let's show "Sufficient" or surplus count if we want, but image implies only negatives are highlighted.
                 // Let's show remaining count in green if positive? Or just nothing special.
                 // Reference image seems to list all, but highlights missing.
                 const surplusBeads = Math.floor((currentStock - neededWeight) * 100 / BEAD_WEIGHT_PER_100);
                 rightContent = `
                    <div style="text-align: right;">
                        <div style="color: #52c41a; font-weight: bold; font-size: 16px;">${surplusBeads > 0 ? surplusBeads : '✔'}</div>
                    </div>
                 `;
             }

             row.innerHTML = `
                 <!-- Left: Color Block & Code -->
                 <div style="display: flex; align-items: center; width: 35%;">
                     <div style="width: 36px; height: 36px; background: ${hex}; border-radius: 6px; margin-right: 10px; border: 1px solid rgba(0,0,0,0.1);"></div>
                     <div style="font-weight: bold; color: #333; font-size: 15px;">${item.code}</div>
                 </div>
                 
                 <!-- Middle: Need / Have -->
                 <div style="flex: 1; text-align: right; padding-right: 20px;">
                     <div style="font-size: 12px; color: #666;">需要 <b>${item.qty.toLocaleString()}</b></div>
                     <div style="font-size: 11px; color: #999; margin-top: 2px;">现有 ${currentBeads.toLocaleString()}</div>
                 </div>
                 
                 <!-- Right: Missing Qty -->
                 <div style="width: 80px; text-align: right;">
                     ${rightContent}
                 </div>
             `;
             list.appendChild(row);
        });
    }

    function executePlanDeduction() {
        if (!currentPlanId) return;
        deductPlanInventory(currentPlanId);
    }

    function rollbackPlanInventory(plan) {
        if (!plan) return;
        
        if (plan.status === 'completed') {
            let restoredCount = 0;
            
            // Find logs associated with this plan
            data.forEach(item => {
                if (item.logs) {
                    // Find logs with matching planId OR matching description (backward compatibility)
                    const logsToRemove = [];
                    item.logs.forEach((log, idx) => {
                        let isMatch = false;
                        if (log.planId && log.planId === plan.id) {
                            isMatch = true;
                        } else if (!log.planId && log.desc && log.desc === `计划扣减: ${plan.name}`) {
                            isMatch = true;
                        }
                        
                        if (isMatch) {
                             logsToRemove.push({ log, idx });
                        }
                    });
                    
                    // Process rollback (reverse order of indices to avoid shifting issues)
                    logsToRemove.sort((a, b) => b.idx - a.idx).forEach(({log, idx}) => {
                        // Restore Stock
                        // "use" log means we subtracted weight, so add it back
                        const val = log.val || 0;
                        item.w = parseFloat((item.w + val).toFixed(2));
                        item.totalUsed = Math.max(0, parseFloat((item.totalUsed - val).toFixed(2)));
                        
                        // Remove log
                        item.logs.splice(idx, 1);
                        restoredCount++;
                    });
                }
            });
            
            if (restoredCount > 0) {
                save();
                render();
            }
        }

        // Recursively rollback sub-plans (for collections)
        if (plan.subPlans && plan.subPlans.length > 0) {
            plan.subPlans.forEach(sub => rollbackPlanInventory(sub));
        }
    }

    // --- Cost Settings Logic ---
    function openCostModal() {
        const storedCost = localStorage.getItem('bead_unit_cost');
        const cost = storedCost ? parseFloat(storedCost) : 0.1; // Default 0.1 per gram
        
        // We reuse the batchInputModal style or create a new small modal for settings
        // Since we want to keep it simple, let's create a specific modal for this
        const modalId = 'costSettingModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            modal.style.width = '85%';
            modal.style.maxWidth = '300px';
            modal.innerHTML = `
                <h3 style="font-size:18px; font-weight:bold; margin-bottom:15px; text-align:center;">成本设置</h3>
                <div style="margin-bottom:20px;">
                    <label style="display:block; margin-bottom:8px; font-size:14px; color:#666;">单克成本 (元/g)</label>
                    <input type="number" id="costInput" step="0.01" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:16px; box-sizing:border-box;">
                    <p style="margin-top:5px; font-size:12px; color:#999;">例如：一包50g卖5元，则单克成本为0.1</p>
                </div>
                <div class="modal-btn-group">
                    <button class="m-btn m-btn-primary" onclick="saveCostSettings()">保存</button>
                    <button class="m-btn m-btn-ghost" onclick="closeAllModals()">取消</button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('costInput').value = cost;
        showModal(modalId);
    }

    function saveCostSettings() {
        const val = parseFloat(document.getElementById('costInput').value);
        if (isNaN(val) || val < 0) {
            alert('请输入有效的金额');
            return;
        }
        localStorage.setItem('bead_unit_cost', val);
        showToast('成本设置已保存');
        closeAllModals();
        
        // Refresh detail page if open
        if (currentPlanId && document.getElementById('page-plan-detail').style.display === 'block') {
            viewPlanDetail(currentPlanId);
        }
    }

    // --- Color Substitution Logic ---
    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
      
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function getColorDistance(color1, color2) {
        // Euclidean distance in RGB space
        // Could be improved with Lab or weighted RGB, but this is sufficient for basic finding
        return Math.sqrt(
            Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2)
        );
    }

    function findSubstituteBead(targetBeadId, requiredWeight) {
        const targetBead = data.find(d => d.id === targetBeadId);
        if (!targetBead || !targetBead.hex) return [];

        const targetRgb = hexToRgb(targetBead.hex);
        if (!targetRgb) return [];

        // Candidates: 
        // 1. Have hex
        // 2. Have enough stock (w >= requiredWeight)
        // 3. Not the target itself
        const candidates = data.filter(d => 
            d.id !== targetBeadId && 
            d.hex && 
            (d.w || 0) >= requiredWeight
        );

        const results = candidates.map(d => {
            const rgb = hexToRgb(d.hex);
            if (!rgb) return null;
            return {
                bead: d,
                dist: getColorDistance(targetRgb, rgb)
            };
        }).filter(r => r !== null);

        // Sort by distance (smaller is better)
        results.sort((a, b) => a.dist - b.dist);

        // Return top 3
        return results.slice(0, 3);
    }

    function showSubstituteModal(targetBeadId, requiredWeight, missingBeadsCount) {
        const substitutes = findSubstituteBead(targetBeadId, requiredWeight);
        
        const modalId = 'substituteModal';
        let modal = document.getElementById(modalId);
        
        // Always recreate content to ensure freshness
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.width = '85%';
        modal.style.maxWidth = '320px';
        modal.style.zIndex = '100000'; // Higher than stock check
        
        const targetBead = data.find(d => d.id === targetBeadId);
        
        let html = `
            <h3 style="font-size:18px; font-weight:bold; margin-bottom:15px; text-align:center;">寻找替补色</h3>
            <div style="text-align:center; margin-bottom:20px;">
                <div style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:#fff1f0; border-radius:8px; border:1px solid #ffa39e;">
                    <div style="width:24px; height:24px; background:${targetBead.hex}; border-radius:4px; border:1px solid rgba(0,0,0,0.1);"></div>
                    <span style="font-weight:bold; color:#cf1322;">${targetBeadId}</span>
                    <span style="color:#666; font-size:12px;">缺 ${missingBeadsCount} 粒</span>
                </div>
            </div>
        `;
        
        if (substitutes.length === 0) {
            html += `<div style="text-align:center; color:#999; padding:20px;">没有找到库存充足的近似色</div>`;
        } else {
            html += `<div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto;">`;
            substitutes.forEach(sub => {
                const d = sub.bead;
                // Calculate match percentage roughly: max dist is sqrt(255^2*3) ≈ 441. 
                // 100 - (dist / 441 * 100)
                const match = Math.max(0, Math.round(100 - (sub.dist / 4.41)));
                
                html += `
                    <div style="display:flex; align-items:center; padding:10px; border:1px solid #eee; border-radius:8px;">
                        <div style="width:30px; height:30px; background:${d.hex}; border-radius:6px; border:1px solid rgba(0,0,0,0.1); margin-right:10px;"></div>
                        <div style="flex:1;">
                            <div style="font-weight:bold; color:#333;">${d.id}</div>
                            <div style="font-size:12px; color:#666;">库存: ${Math.floor(d.w * 100)} 粒</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px; color:#52c41a; font-weight:bold;">相似度 ${match}%</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `
            <div class="modal-btn-group" style="margin-top:20px;">
                <button class="m-btn m-btn-primary" onclick="document.getElementById('${modalId}').style.display='none';">关闭</button>
            </div>
        `;
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
        
        // Show logic (manual because we need high z-index and it's a second modal)
        modal.style.display = 'block';
        // Ensure backdrop is handled if needed, but since we are over another modal, we might just overlay.
        // Or we can use showModal if we manage z-index carefully.
        // Let's manually set it to be safe on top of 99999
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
    }

    function revertPlanToActive(id) {
        currentRevertPlanId = id;
        showModal('revertConfirmModal');
    }

    function confirmRevertPlan() {
        if (!currentRevertPlanId) return;
        const id = currentRevertPlanId;
        closeAllModals();

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(id, plans);
        if (!plan) return;
        
        rollbackPlanInventory(plan);
        
        plan.status = 'active';
        delete plan.completedAt;
        
        // Check parent status (revert if needed)
        updateParentCollectionStatus(plans, plan.id);

        localStorage.setItem('bead_plans', JSON.stringify(plans));
        renderPlans();
        showToast('计划已撤销为“计划中”，库存已回滚。');
        currentRevertPlanId = null;
    }

    function duplicatePlan(id) {
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const original = findPlanById(id, plans);
        if (!original) return;
        
        // Find parent folder if exists
        const parent = findParent(id, plans, null);
        
        const newPlan = JSON.parse(JSON.stringify(original));
        newPlan.id = 'plan_' + Date.now();
        newPlan.name = original.name + ' (副本)';
        newPlan.createdAt = Date.now();
        newPlan.status = 'active';
        delete newPlan.completedAt;
        delete newPlan.timeSpent;
        // delete newPlan.subPlans; // Keep subPlans structure if it's a folder
        
        // If it's a folder (has subPlans), we need to update IDs of subPlans too
        if (newPlan.subPlans) {
             const updateIds = (list) => {
                 list.forEach(p => {
                     p.id = 'plan_' + Math.random().toString(36).substr(2, 9);
                     p.createdAt = Date.now();
                     p.status = 'active';
                     delete p.completedAt;
                     delete p.timeSpent;
                     if(p.subPlans) updateIds(p.subPlans);
                 });
             };
             updateIds(newPlan.subPlans);
        }

        if (parent) {
            // Insert into parent folder
            if (!parent.subPlans) parent.subPlans = [];
            parent.subPlans.unshift(newPlan);
            recalculatePlanItems(parent);
        } else {
            // Insert into root
            plans.unshift(newPlan);
        }
        
        localStorage.setItem('bead_plans', JSON.stringify(plans));
        
        showToast('计划已复制');
        renderPlans();
    }

    function hasCompletedStatusRecursive(plan) {
        if (!plan) return false;
        if (plan.status === 'completed') return true;
        if (plan.subPlans && plan.subPlans.length > 0) {
            return plan.subPlans.some(sub => hasCompletedStatusRecursive(sub));
        }
        return false;
    }

    function deletePlan(id) {
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(id, plans); 
        
        if (!plan) return;

        const hasCompleted = hasCompletedStatusRecursive(plan);
        const msg = '确定要删除这个计划吗？' + (hasCompleted ? '<br><span style="color:#ff4d4f; font-weight:bold;">注意：包含已完成的计划，删除将自动回滚库存！</span>' : '');

        document.getElementById('deleteConfirmMsg').innerHTML = msg;
        currentDeletePlanId = id;
        showModal('deleteConfirmModal');
    }

    function confirmDeletePlan() {
        if (!currentDeletePlanId) return;
        const id = currentDeletePlanId;
        closeAllModals();

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(id, plans);
        
        if (!plan) return;

        const hasCompleted = hasCompletedStatusRecursive(plan);
        
        if (hasCompleted) {
             rollbackPlanInventory(plan);
        }

        const result = deletePlanRecursive(plans, id);

        if (result.deleted) {
            localStorage.setItem('bead_plans', JSON.stringify(plans));
            if (currentPlanId === id) closePlanDetail();
            renderPlans();
            showToast('计划已删除');
        }
        currentDeletePlanId = null;
    }

    function deletePlanRecursive(list, id) {
        const idx = list.findIndex(p => p.id === id);
        if (idx !== -1) {
            list.splice(idx, 1);
            return { deleted: true, parentModified: false };
        }
        
        for (let p of list) {
            if (p.subPlans) {
                const res = deletePlanRecursive(p.subPlans, id);
                if (res.deleted) {
                    recalculatePlanItems(p);
                    return { deleted: true, parentModified: true };
                }
            }
        }
        return { deleted: false };
    }

    function recalculatePlanItems(plan) {
        const aggregatedItems = new Map();
        plan.subPlans.forEach(sub => {
            sub.items.forEach(item => {
                const currentQty = aggregatedItems.get(item.code) || 0;
                aggregatedItems.set(item.code, currentQty + item.qty);
            });
        });
        
        const newItems = [];
        aggregatedItems.forEach((qty, code) => {
            newItems.push({ code, qty });
        });
        plan.items = newItems;
    }

    function playSuccessSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            
            // "Tada" effect: C5 - E5 - G5 - C6
            const notes = [523.25, 659.25, 783.99, 1046.50];
            
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine'; // Sine for clean bell-like sound
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                
                gain.gain.setValueAtTime(0.1, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4); // Decay
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.4);
            });
            
            // Confetti sound (noise burst)
            const bufferSize = ctx.sampleRate * 0.5; // 0.5 sec
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.05, now + 0.3);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            
            // Filter to make it sound like 'pop'
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            
            noise.start(now + 0.3);
            
        } catch(e) {
            console.error("Audio play failed", e);
        }
    }

    let currentDeductPlanId = null;

    function deductPlanInventory(id) {
        currentDeductPlanId = id;
        const plan = findPlanById(id, JSON.parse(localStorage.getItem('bead_plans') || '[]'));
        if(!plan) return;

        document.getElementById('deductPlanName').textContent = `计划: ${plan.name}`;
        // Reset inputs
        document.getElementById('deductTimeHours').value = '';
        document.getElementById('deductTimeMinutes').value = '';
        showModal('deductModal');
    }

    function confirmDeduct() {
        const id = currentDeductPlanId;
        if (!id) return;
        
        closeAllModals();

        // Load plans so we can update status and save
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const plan = findPlanById(id, plans);
        if(!plan) return;

        // One-click deduction per user preference (no confirm) -> Now with custom modal confirmed


        const BEAD_WEIGHT_PER_100 = 1;
        let count = 0;
        
        // Get time spent from new inputs
        const hVal = document.getElementById('deductTimeHours').value.trim();
        const mVal = document.getElementById('deductTimeMinutes').value.trim();
        let timeSpent = '';

        if (hVal !== '' || mVal !== '') {
            const h = parseInt(hVal) || 0;
            const m = parseInt(mVal) || 0;
            
            if (h < 0 || m < 0) {
                alert('耗时记录不能为负数');
                return;
            }
            if (h === 0 && m === 0) {
                 // User entered 0 and 0.
                 // Request: "允许都填0" (Allow both to be 0)
                 // This means explicit 0h 0m is a valid record, likely meaning "negligible time" or just explicitly recorded as 0.
                 // If both are empty, we treat as no record.
                 // If at least one is "0" and the other is empty or "0", we treat as 0 time.
                 
                 if (hVal !== '' || mVal !== '') {
                      timeSpent = '0分钟'; // Or "0小时0分钟"
                 }
                 // If both empty, fall through (timeSpent stays '')
            } else {
                 // Format: X小时Y分钟 or just X小时 or Y分钟
                 // To be consistent with parser: "Xh Ym" or "X小时Y分钟"
                 if (h > 0 && m > 0) timeSpent = `${h}小时${m}分钟`;
                 else if (h > 0) timeSpent = `${h}小时`;
                 else if (m > 0) timeSpent = `${m}分钟`;
            }
        }

        plan.items.forEach(pItem => {
             const item = data.find(d => d.id === pItem.code);
             if(item) {
                 const weightToDeduct = parseFloat((pItem.qty / 100 * BEAD_WEIGHT_PER_100).toFixed(2));
                 item.w = parseFloat((item.w - weightToDeduct).toFixed(2));
                 
                 if (!item.logs) item.logs = [];
                 item.logs.push({
                    d: formatTime(new Date()),
                    type: 'use', 
                    val: weightToDeduct,
                    c: pItem.qty, 
                    desc: `计划扣减: ${plan.name}`,
                    drawingName: plan.name,
                    planId: plan.id,
                    timeSpent: timeSpent // Record time spent
                 });
                 item.totalUsed = parseFloat(((item.totalUsed || 0) + weightToDeduct).toFixed(2));
                 count++;
             }
        });
        
        let forceComplete = false;
        if (count === 0) {
            forceComplete = confirm('未在库存中找到计划包含的色号，未扣减任何库存。\n\n是否仍要将此计划标记为“已完成”？');
        }

        if(count > 0 || forceComplete) {
            if (count > 0) {
                save();
                render(); // Update inventory UI
            }
            
            // Mark as completed
            plan.status = 'completed';
            plan.completedAt = Date.now();
            if (timeSpent) {
                plan.timeSpent = timeSpent;
            } else {
                delete plan.timeSpent;
            }
            
            // Check if parent collection is now fully completed
            updateParentCollectionStatus(plans, plan.id);

            localStorage.setItem('bead_plans', JSON.stringify(plans));
            
            showToast(count > 0 ? '库存扣减成功！计划已标记为“已完成”。' : '计划已标记为“已完成”。');
            playSuccessSound(); // Play confetti sound
            renderPlans();
            
            // Refresh detail view if open
            if (currentPlanId === id) {
                viewPlanDetail(id);
            }
        }
    }

    function updateParentCollectionStatus(plans, childId) {
        // Find parent (Recursive search)
        function findParent(list, id) {
            for (let p of list) {
                if (p.subPlans) {
                    if (p.subPlans.some(sub => sub.id === id)) return p;
                    const found = findParent(p.subPlans, id);
                    if (found) return found;
                }
            }
            return null;
        }

        let parent = findParent(plans, childId);
        
        if (parent) {
            const allCompleted = parent.subPlans.every(sub => sub.status === 'completed');
            if (allCompleted) {
                // Only update if not already completed
                if (parent.status !== 'completed') {
                    parent.status = 'completed';
                    parent.completedAt = Date.now();
                }
            } else {
                // If we are reverting a child, we might need to revert parent
                if (parent.status === 'completed') {
                    parent.status = 'active';
                    delete parent.completedAt;
                }
            }
            
            // If parent itself has a parent, we might need to propagate up?
            // e.g. GrandParent -> Parent -> Child.
            // If Parent becomes completed, GrandParent might need to check.
            updateParentCollectionStatus(plans, parent.id);
        }
    }

    function enterPlanSelectionMode(initialId) {
        if (isPlanSelectionMode) return;
        isPlanSelectionMode = true;
        selectedPlanIds.clear();
        if (initialId) {
            selectedPlanIds.add(initialId);
        }
        
        const bar = document.getElementById('planSelectionBar');
        bar.style.display = 'flex';
        bar.style.animation = 'none';
        bar.offsetHeight; 
        bar.style.animation = 'slideUp 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        
        updateSelectionUI();
        renderPlans();
        
        if (navigator.vibrate) navigator.vibrate(50);
    }

    function exitPlanSelectionMode() {
        isPlanSelectionMode = false;
        selectedPlanIds.clear();
        document.getElementById('planSelectionBar').style.display = 'none';
        renderPlans();
    }

    function showEditTimeModal(planId) {
        console.log('showEditTimeModal called with:', planId);
        try {
            const plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
            const plan = findPlanById(planId, plans);
            
            if (!plan) {
                console.error('Plan not found:', planId);
                alert('未找到该计划，无法编辑耗时 (ID: ' + planId + ')');
                return;
            }

            document.getElementById('editTimePlanId').value = planId;
            
            let h = '';
            let m = '';
            if (plan.timeSpent) {
                // Support both "2h 30m" and "2小时30分钟" formats
                let hMatch = plan.timeSpent.match(/(\d+)h/);
                let mMatch = plan.timeSpent.match(/(\d+)m/);
                
                if (!hMatch) hMatch = plan.timeSpent.match(/(\d+)小时/);
                if (!mMatch) mMatch = plan.timeSpent.match(/(\d+)分钟/);
                
                if (hMatch) h = hMatch[1];
                if (mMatch) m = mMatch[1];
            }
            
            const elHours = document.getElementById('editTimeHours');
            const elMinutes = document.getElementById('editTimeMinutes');

            if (elHours) elHours.value = h;
            if (elMinutes) elMinutes.value = m;
            
            // Force show mask and modal with explicit z-index handling
            const modal = document.getElementById('editTimeModal');
            const mask = document.getElementById('mask');
            
            // 1. Show Mask (High Z-Index)
            mask.style.display = 'block';
            mask.style.zIndex = '9999'; 
            
            // 2. Show Modal (Higher Z-Index)
            modal.style.display = 'block';
            modal.style.zIndex = '10001';
            
            // 3. Reset Animation to ensure it plays
             modal.style.animation = 'none';
             modal.offsetHeight; // trigger reflow
             modal.style.animation = 'modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
             
             // Ensure position is correct
             modal.style.position = 'fixed';
             modal.style.top = '50%';
             modal.style.left = '50%';
             modal.style.transform = 'translate(-50%, -50%)';
             
         } catch (e) {
             console.error('Error in showEditTimeModal:', e);
            alert('打开编辑弹窗出错: ' + e.message);
        }
    }
    window.showEditTimeModal = showEditTimeModal;

    function savePlanTime() {
        const planId = document.getElementById('editTimePlanId').value;
        const hVal = document.getElementById('editTimeHours').value.trim();
        const mVal = document.getElementById('editTimeMinutes').value.trim();
        
        const h = hVal ? parseInt(hVal, 10) : 0;
        const m = mVal ? parseInt(mVal, 10) : 0;
        
        let timeStr = '';
        if (h > 0) timeStr += `${h}h `;
        if (m > 0) timeStr += `${m}m`;
        timeStr = timeStr.trim();
        
        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        
        const update = (list) => {
            for (let p of list) {
                if (p.id === planId) {
                    if (timeStr) {
                        p.timeSpent = timeStr;
                    } else {
                        delete p.timeSpent;
                    }
                    return true;
                }
                if (p.subPlans && p.subPlans.length > 0) {
                    if (update(p.subPlans)) return true;
                }
            }
            return false;
        };
        
        if (update(plans)) {
            localStorage.setItem('bead_plans', JSON.stringify(plans));
            closeAllModals();
            renderPlans();
            
            // If we are on the detail page for this plan, refresh it
            if (document.getElementById('page-plan-detail').style.display === 'block' && currentPlanId === planId) {
                 viewPlanDetail(planId);
            }
            
            showToast('耗时已更新');
            if (typeof updatePlanOverviewStats === 'function') updatePlanOverviewStats();
        }
    }

    function togglePlanSelection(id) {
        if (selectedPlanIds.has(id)) {
            selectedPlanIds.delete(id);
        } else {
            selectedPlanIds.add(id);
        }
        updateSelectionUI();
        renderPlans();
    }

    function updateSelectionUI() {
        document.getElementById('selectedCount').innerText = selectedPlanIds.size;
    }

    function mergeSelectedPlans() {
        if (selectedPlanIds.size < 2) {
            alert('请至少选择两个项（包括一个目标合集）进行操作。');
            return;
        }

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        
        // Find all selected plans (recursive search)
        let selectedPlans = [];
        selectedPlanIds.forEach(id => {
            const p = findPlanById(id, plans);
            if(p) selectedPlans.push(p);
        });
        
        if (selectedPlans.length === 0) return;

        // Identify Folders
        const isFolder = (p) => Array.isArray(p.subPlans) && p.subPlans.length > 0;
        const folders = selectedPlans.filter(isFolder);
        const regularPlans = selectedPlans.filter(p => !isFolder(p));

        // Case: Multiple Folders -> Error
        if (folders.length > 1) {
            alert('无法合并多个合集，也无法将合集放入另一个合集。请只选择一个目标合集。');
            return;
        }

        // Case: 1 Folder + Regular Plans -> Move Plans into Folder
        if (folders.length === 1) {
            const targetFolder = folders[0];
            if (regularPlans.length === 0) {
                alert('请选择要移入该合集的计划。');
                return;
            }

            // Move regularPlans into targetFolder
            regularPlans.forEach(p => {
                deletePlanRecursive(plans, p.id);
            });

            // Add to target folder
            // Note: targetFolder reference is still valid and connected to 'plans' tree
            // unless it was somehow deleted (which shouldn't happen as we didn't select it for deletion)
            if (!targetFolder.subPlans) targetFolder.subPlans = [];
            targetFolder.subPlans.unshift(...regularPlans); // Add to top

            // Update folder stats
            if (typeof recalculatePlanItems === 'function') {
                recalculatePlanItems(targetFolder);
            } else {
                // Fallback if function not found (re-implement basic aggregation)
                const aggregatedItems = new Map();
                const collectItems = (list) => {
                    list.forEach(p => {
                        if (p.subPlans && p.subPlans.length > 0) collectItems(p.subPlans);
                        else p.items.forEach(i => {
                            aggregatedItems.set(i.code, (aggregatedItems.get(i.code)||0) + i.qty);
                        });
                    });
                };
                collectItems(targetFolder.subPlans);
                targetFolder.items = Array.from(aggregatedItems.entries()).map(([code, qty]) => ({code, qty}));
            }

            localStorage.setItem('bead_plans', JSON.stringify(plans));
            showToast(`已将 ${regularPlans.length} 个计划移入合集“${targetFolder.name}”。`);
            exitPlanSelectionMode();
            return;
        }

        // Case: All Regular Plans -> Create New Collection
        // Filter out descendants (prevent double inclusion)
        const containsPlan = (container, targetId) => {
            if (!container.subPlans) return false;
            for (let sp of container.subPlans) {
                if (sp.id === targetId) return true;
                if (containsPlan(sp, targetId)) return true;
            }
            return false;
        };

        const topLevelSelected = selectedPlans.filter(p => {
            // Check if p is inside any other selected plan
            return !selectedPlans.some(other => other !== p && containsPlan(other, p.id));
        });

        if (topLevelSelected.length < 2) {
             alert('请至少选择两个计划进行合并。');
             return;
        }

        // Create New Plan
        const aggregatedItems = new Map();
        topLevelSelected.forEach(plan => {
            plan.items.forEach(item => {
                const currentQty = aggregatedItems.get(item.code) || 0;
                aggregatedItems.set(item.code, currentQty + item.qty);
            });
        });

        const newItems = [];
        aggregatedItems.forEach((qty, code) => {
            newItems.push({ code, qty });
        });

        const defaultName = `合集: ${topLevelSelected[0].name} 等${topLevelSelected.length}个计划`;
        pendingMergePlans = topLevelSelected;
        
        const nameInput = document.getElementById('collectionNameInput');
        nameInput.value = '';
        nameInput.placeholder = defaultName;
        showModal('createCollectionModal');
    }
    
    function confirmCreateCollection() {
        if (!pendingMergePlans) return;
        const topLevelSelected = pendingMergePlans;
        let newPlanName = document.getElementById('collectionNameInput').value;
        closeAllModals();

        let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        
        // Create New Plan
        const aggregatedItems = new Map();
        topLevelSelected.forEach(plan => {
            plan.items.forEach(item => {
                const currentQty = aggregatedItems.get(item.code) || 0;
                aggregatedItems.set(item.code, currentQty + item.qty);
            });
        });

        const newItems = [];
        aggregatedItems.forEach((qty, code) => {
            newItems.push({ code, qty });
        });

        const defaultName = `合集: ${topLevelSelected[0].name} 等${topLevelSelected.length}个计划`;
        newPlanName = newPlanName.trim() || defaultName;
        
        // Determine status based on selected plans
        const isAllCompleted = topLevelSelected.every(p => p.status === 'completed');

        const newPlan = {
            id: 'plan_group_' + Date.now(),
            name: newPlanName,
            createdAt: Date.now(),
            items: newItems,
            status: isAllCompleted ? 'completed' : 'active',
            completedAt: isAllCompleted ? Date.now() : undefined,
            subPlans: topLevelSelected,
            thumbnail: null
        };

        // Remove topLevelSelected from the tree
        topLevelSelected.forEach(p => {
             deletePlanRecursive(plans, p.id);
        });
        
        // Add new plan to root
        plans.unshift(newPlan);
        
        localStorage.setItem('bead_plans', JSON.stringify(plans));

        showToast('合并成功！已生成新的合集计划。');
        exitPlanSelectionMode();
        pendingMergePlans = null;
    }
    

    // --- Copy Aggregated Shopping List ---
    function copyMissingSummary() {
        const plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        const summary = aggregateActivePlanRequirements(plans);
        if (!summary || summary.shortages.length === 0) {
            showToast("当前没有缺货色号");
            return;
        }
        
        // Format: "缺货预警：\nC11 缺9.66g\nC13 缺4.52g"
        summary.shortages.sort((a, b) => b.missingQty - a.missingQty);
        
        // Calculate beads count: missingQty * 100 (since 1g=100beads approx in this system's logic or using BEAD_WEIGHT_PER_100=1)
        // Let's use standard unit "包" or "粒" if preferred. 
        // User asked for "A1: 需补2包". Let's assume 1 bag = 500 or 1000? 
        // Or just output grams/count. Let's output grams and estimated count.
        
        const text = "【补货清单】\n" + summary.shortages.map(item => {
            // item.missingQty is in 'g' (based on currentStock vs neededWeight logic)
            // 1 unit in system usually 10g (1000 beads)
            // Let's just output "Need X g"
            const bags = Math.ceil(item.missingQty / 50); // Assume 1 bag = 50g
            return `${item.code}: 缺${Math.ceil(item.missingQty)}g (约${bags}包)`;
        }).join('\n');
        
        // Web Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
             navigator.clipboard.writeText(text).then(() => {
                showToast("已复制补货清单");
             }).catch(err => {
                fallbackCopyText(text);
             });
        } else {
             fallbackCopyText(text);
        }
    }

    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; 
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast("已复制补货清单");
        } catch (err) {
            console.error('Fallback copy failed', err);
            showToast("复制失败");
        }
        document.body.removeChild(textArea);
    }


</script>
<script>
let batchAddSelection = {}; // { id: qty }
let batchCurrentSeries = 'A';
let batchMode = 'add'; // 'add' | 'deduct'

function openBatchOperation() {
    batchAddSelection = {};
    document.getElementById('batchAddModal').style.display = 'flex';
    
    // Default to Add mode
    setBatchMode('add');
    
    // Find all series
    const series = new Set();
    data.forEach(d => {
        const match = d.id.match(/^[A-Z]+/);
        if(match) series.add(match[0]);
    });
    const sortedSeries = Array.from(series).sort();
    if(sortedSeries.length > 0) batchCurrentSeries = sortedSeries[0];
    
    renderBatchAddTabs(sortedSeries);
    renderBatchAddList();
    updateBatchSummary();
}

function setBatchMode(mode) {
    batchMode = mode;
    batchAddSelection = {}; 
    
    const btnAdd = document.getElementById('batchModeAdd');
    const btnDeduct = document.getElementById('batchModeDeduct');
    const confirmBtn = document.getElementById('batchConfirmBtn');
    
    if(mode === 'add') {
        btnAdd.style.background = 'white';
        btnAdd.style.color = '#4a90e2';
        btnAdd.style.fontWeight = 'bold';
        btnAdd.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        
        btnDeduct.style.background = 'transparent';
        btnDeduct.style.color = '#666';
        btnDeduct.style.fontWeight = 'normal';
        btnDeduct.style.boxShadow = 'none';
        
        confirmBtn.innerText = '确认入库';
        confirmBtn.style.background = '#4a90e2';
    } else {
        btnDeduct.style.background = 'white';
        btnDeduct.style.color = '#e24a4a';
        btnDeduct.style.fontWeight = 'bold';
        btnDeduct.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        
        btnAdd.style.background = 'transparent';
        btnAdd.style.color = '#666';
        btnAdd.style.fontWeight = 'normal';
        btnAdd.style.boxShadow = 'none';
        
        confirmBtn.innerText = '确认出库';
        confirmBtn.style.background = '#e24a4a';
    }
    
    renderBatchAddList();
    updateBatchSummary();
}

function closeBatchAdd() {
    document.getElementById('batchAddModal').style.display = 'none';
}

function renderBatchAddTabs(allSeries) {
    const container = document.getElementById('batchAddSeriesTabs');
    container.innerHTML = '';
    allSeries.forEach(s => {
        const div = document.createElement('div');
        div.className = `batch-tab ${s === batchCurrentSeries ? 'active' : ''}`;
        div.innerText = s;
        div.onclick = () => {
            batchCurrentSeries = s;
            renderBatchAddTabs(allSeries);
            renderBatchAddList();
        };
        container.appendChild(div);
    });
}

function renderBatchAddList() {
    const container = document.getElementById('batchAddList');
    container.innerHTML = '';
    
    const items = data.filter(d => d.id.startsWith(batchCurrentSeries));
    
    items.forEach(item => {
        const isSelected = batchAddSelection[item.id] !== undefined;
        let qty = batchAddSelection[item.id];
        if (qty === undefined) {
             qty = (batchMode === 'add') ? 1 : ''; 
        }
        
        const div = document.createElement('div');
        div.className = `batch-item ${isSelected ? 'selected' : ''}`;
        div.onclick = (e) => {
            if(e.target.closest('.batch-stepper') || e.target.tagName === 'INPUT') return;
            toggleBatchItem(item.id);
        };
        
        let controlsHtml = '';
        if (isSelected) {
            if (batchMode === 'add') {
                controlsHtml = `
                <div class="batch-stepper">
                    <div class="batch-step-btn" onclick="updateBatchQty('${item.id}', -1)">-</div>
                    <input type="number" class="batch-input" value="${qty}" step="0.1" onchange="updateBatchQtyInput('${item.id}', this.value)" onclick="event.stopPropagation()">
                    <div class="batch-step-btn add" onclick="updateBatchQty('${item.id}', 1)">+</div>
                </div>
                <div style="font-size: 10px; color: #999; margin-left: 5px;">x1000</div>
                `;
            } else {
                 controlsHtml = `
                <div class="batch-stepper" style="border-color:#e24a4a; height: 30px; display: flex; align-items: center;">
                    <div style="padding-left: 8px; color: #e24a4a; font-weight: bold;">-</div>
                    <input type="number" class="batch-input" style="width:60px; text-align:center; height: 100%;" value="${qty}" placeholder="" onchange="updateBatchQtyInput('${item.id}', this.value)" onclick="event.stopPropagation()">
                </div>
                <div style="font-size: 10px; color: #999; margin-left: 5px;">粒</div>
                `;
            }
        }
        
        div.innerHTML = `
            <div class="batch-check"></div>
            <div style="width: 36px; height: 36px; background: ${item.hex}; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); margin-right: 15px;"></div>
            <div style="flex: 1; font-weight: bold; font-size: 16px;">${item.id}</div>
            ${controlsHtml}
        `;
        container.appendChild(div);
    });
}

function toggleBatchItem(id) {
    if (batchAddSelection[id] !== undefined) {
        delete batchAddSelection[id];
    } else {
        batchAddSelection[id] = (batchMode === 'add') ? 1 : '';
    }
    renderBatchAddList();
    updateBatchSummary();
}

function updateBatchQty(id, delta) {
    if (batchAddSelection[id] === undefined) return;
    
    if (batchMode === 'add') {
        let newQty = parseFloat(batchAddSelection[id]) + delta;
        newQty = parseFloat(newQty.toFixed(1));
        if (newQty <= 0) {
            delete batchAddSelection[id];
        } else {
            batchAddSelection[id] = newQty;
        }
    }
    renderBatchAddList();
    updateBatchSummary();
}

function updateBatchQtyInput(id, val) {
    if (batchMode === 'add') {
        let newQty = parseFloat(val);
        if (isNaN(newQty) || newQty <= 0) {
            delete batchAddSelection[id];
        } else {
            batchAddSelection[id] = parseFloat(newQty.toFixed(1));
        }
    } else {
        if (val === '') {
             batchAddSelection[id] = '';
        } else {
            let newQty = parseInt(val);
            if (isNaN(newQty) || newQty <= 0) {
                // Keep selection but maybe invalid? 
                // If user enters -5, we should probably reject or set to something valid.
                // For now, if invalid, delete selection? Or just don't update?
                // Deleting selection might be annoying if accidental.
                // Let's just set to valid or ignore.
                // If <= 0, delete.
                if (newQty <= 0) delete batchAddSelection[id];
                else batchAddSelection[id] = newQty;
            } else {
                batchAddSelection[id] = newQty;
            }
        }
    }
    updateBatchSummary();
}

function toggleBatchSelectAll() {
    const items = data.filter(d => d.id.startsWith(batchCurrentSeries));
    const allSelected = items.every(item => batchAddSelection[item.id] !== undefined);
    
    if (allSelected) {
        items.forEach(item => delete batchAddSelection[item.id]);
    } else {
        items.forEach(item => {
            if(batchAddSelection[item.id] === undefined) {
                 batchAddSelection[item.id] = (batchMode === 'add') ? 1 : '';
            }
        });
    }
    renderBatchAddList();
    updateBatchSummary();
}

function updateBatchSummary() {
    const count = Object.keys(batchAddSelection).length;
    let total = 0;
    
    Object.values(batchAddSelection).forEach(q => {
        if(q === '' || q === undefined) return;
        if(batchMode === 'add') {
            total += q * 1000;
        } else {
            total += q;
        }
    });
    
    document.getElementById('batchAddCount').innerText = count;
    const totalDisplay = document.getElementById('batchTotalDisplay');
    const totalSpan = document.getElementById('batchAddTotal');
    
    if(batchMode === 'add') {
        totalDisplay.innerHTML = `共 +<span id="batchAddTotal">0</span> 粒`;
        document.getElementById('batchAddTotal').innerText = (total >= 1000) ? (total/1000).toFixed(1) + 'K' : total;
    } else {
        totalDisplay.innerHTML = `共 -<span id="batchAddTotal">0</span> 粒`;
        document.getElementById('batchAddTotal').innerText = total;
    }
}

function confirmBatchAdd() {
    const count = Object.keys(batchAddSelection).length;
    if (count === 0) return;
    
    const now = new Date();
    const dateStr = formatTime(now);
    
    if (batchMode === 'add') {
        Object.entries(batchAddSelection).forEach(([id, qty]) => {
            const item = data.find(d => d.id === id);
            if(item) {
                const weightToAdd = qty * 10; 
                item.w = parseFloat((item.w + weightToAdd).toFixed(2));
                item.totalAdded = parseFloat(((item.totalAdded || 0) + weightToAdd).toFixed(2));
                
                if(!item.logs) item.logs = [];
                item.logs.push({ d: dateStr, type: 'add', val: weightToAdd, note: '批量入库' });
                if(item.logs.length > 20) item.logs.shift();
            }
        });
        showToast("入库成功！");
    } else {
        // Deduct mode
        let warnings = [];
        let validDeductions = [];
        
        for (const [id, qty] of Object.entries(batchAddSelection)) {
            if (!qty) continue;
            const item = data.find(d => d.id === id);
            if (!item) continue;
            
            const currentBeads = Math.round(item.w * 100); 
            const deductBeads = qty;
            
            if (deductBeads > currentBeads) {
                warnings.push(`${id} (库存: ${currentBeads}, 扣除: ${deductBeads})`);
            }
            
            const weightToDeduct = parseFloat((deductBeads * 0.01).toFixed(2));
            validDeductions.push({ item, weightToDeduct, beads: deductBeads });
        }
        
        if (warnings.length > 0) {
            const msg = "以下色号扣除数量超过当前库存：\n" + warnings.join("\n") + "\n\n是否继续扣除？";
            if (!confirm(msg)) return;
        }
        
        validDeductions.forEach(({ item, weightToDeduct, beads }) => {
            item.w = parseFloat((item.w - weightToDeduct).toFixed(2));
            item.used = parseFloat(((item.used || 0) + weightToDeduct).toFixed(2));
             
            if(!item.logs) item.logs = [];
            item.logs.push({ d: dateStr, type: 'use', val: weightToDeduct, c: beads, note: '批量出库' });
            if(item.logs.length > 20) item.logs.shift();
        });
        showToast("出库成功！");
    }
    
    save();
    render();
    closeBatchAdd();
}
    // --- Pull to Refresh Logic ---
    let ptrStartY = 0;
    let ptrCurrentY = 0;
    let ptrDistance = 0;
    let isPtrActive = false;
    let isPtrLoading = false;
    const PTR_THRESHOLD = 80;
    
    // Main scrollable element is body/window
    window.addEventListener('touchstart', (e) => {
        // Only enable on specific pages
        const activePage = ['page-beads', 'page-stats', 'page-plan', 'page-fabric'].find(id => document.getElementById(id).style.display !== 'none');
        if (!activePage) return;
        
        if (window.scrollY === 0 && !isPtrLoading) {
            ptrStartY = e.touches[0].clientY;
            isPtrActive = true;
        }
    }, {passive: true});
    
    window.addEventListener('touchmove', (e) => {
        if (!isPtrActive || isPtrLoading) return;
        
        ptrCurrentY = e.touches[0].clientY;
        const diff = ptrCurrentY - ptrStartY;
        
        // Only track pull down
        if (diff > 0 && window.scrollY === 0) {
            // Resistance effect
            ptrDistance = Math.pow(diff, 0.8);
            
            // Limit max pull
            if (ptrDistance > 150) ptrDistance = 150;
            
            updatePtrVisuals(ptrDistance);
        } else {
            isPtrActive = false;
            resetPtr();
        }
    }, {passive: true});
    
    window.addEventListener('touchend', () => {
        if (!isPtrActive || isPtrLoading) return;
        
        if (ptrDistance > PTR_THRESHOLD) {
            startPtrLoading();
        } else {
            resetPtr();
        }
        isPtrActive = false;
    });
    
    function updatePtrVisuals(dist) {
        const indicator = document.getElementById('ptr-indicator');
        const icon = document.getElementById('ptr-icon');
        const text = document.getElementById('ptr-text');
        
        indicator.style.transform = `translateY(${dist}px)`;
        
        if (dist > PTR_THRESHOLD) {
            text.textContent = "释放刷新";
            icon.style.transform = "rotate(180deg)";
        } else {
            text.textContent = "下拉刷新";
            icon.style.transform = "rotate(0deg)";
        }
    }
    
    function startPtrLoading() {
        isPtrLoading = true;
        const indicator = document.getElementById('ptr-indicator');
        const icon = document.getElementById('ptr-icon');
        const spinner = document.getElementById('ptr-spinner');
        const text = document.getElementById('ptr-text');
        
        indicator.style.transform = `translateY(50px)`;
        icon.style.display = 'none';
        spinner.style.display = 'block';
        text.textContent = "加载中...";
        
        // Simulate refresh delay
        setTimeout(() => {
            window.location.reload();
        }, 800);
    }
    
    function resetPtr() {
        const indicator = document.getElementById('ptr-indicator');
        const icon = document.getElementById('ptr-icon');
        const spinner = document.getElementById('ptr-spinner');
        
        indicator.style.transform = `translateY(0)`;
        icon.style.display = 'inline';
        icon.style.transform = "rotate(0deg)";
        spinner.style.display = 'none';
        ptrDistance = 0;
    }

    // --- Plan Image Viewer Logic ---
    let imgScale = 1;
    let imgTranslateX = 0;
    let imgTranslateY = 0;
    let imgStartX = 0;
    let imgStartY = 0;
    let imgIsDragging = false;
    let imgInitialPinchDist = 0;
    let imgInitialScale = 1;

    function openPlanImageViewer() {
        const detailImg = document.getElementById('planDetailImage');
        const fullImg = document.getElementById('planFullImage');
        if (!detailImg.src) return;
        
        fullImg.src = detailImg.src;
        document.getElementById('planImageViewer').style.display = 'block';
        resetPlanImageZoom();
        
        // Disable page scroll
        document.body.style.overflow = 'hidden';
    }

    function closePlanImageViewer() {
        document.getElementById('planImageViewer').style.display = 'none';
        document.body.style.overflow = '';
    }

    function resetPlanImageZoom() {
        imgScale = 1;
        imgTranslateX = 0;
        imgTranslateY = 0;
        updateImageTransform();
    }

    function updateImageTransform() {
        const img = document.getElementById('planFullImage');
        img.style.transform = `translate(${imgTranslateX}px, ${imgTranslateY}px) scale(${imgScale})`;
    }

    // Touch Event Handlers
    const viewer = document.getElementById('planImageViewer');
    
    viewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Pinch
            imgIsDragging = false;
            imgInitialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            imgInitialScale = imgScale;
        } else if (e.touches.length === 1) {
            // Pan
            imgIsDragging = true;
            imgStartX = e.touches[0].clientX - imgTranslateX;
            imgStartY = e.touches[0].clientY - imgTranslateY;
        }
    });

    viewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = currentDist / imgInitialPinchDist;
            let newScale = imgInitialScale * ratio;
            newScale = Math.min(Math.max(0.5, newScale), 5); // Limit 0.5x to 5x
            imgScale = newScale;
            updateImageTransform();
        } else if (e.touches.length === 1 && imgIsDragging) {
            e.preventDefault();
            imgTranslateX = e.touches[0].clientX - imgStartX;
            imgTranslateY = e.touches[0].clientY - imgStartY;
            updateImageTransform();
        }
    });

    viewer.addEventListener('touchend', () => {
        imgIsDragging = false;
    });

    // Mouse Events for Desktop Testing
    let isMouseDownViewer = false;
    viewer.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'IMG' || e.target.id === 'planImageWrapper') {
             isMouseDownViewer = true;
             imgStartX = e.clientX - imgTranslateX;
             imgStartY = e.clientY - imgTranslateY;
        }
    });

    viewer.addEventListener('mousemove', (e) => {
        if (!isMouseDownViewer) return;
        e.preventDefault();
        imgTranslateX = e.clientX - imgStartX;
        imgTranslateY = e.clientY - imgStartY;
        updateImageTransform();
    });

    viewer.addEventListener('mouseup', () => {
        isMouseDownViewer = false;
    });

    viewer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY) * 0.1;
        let newScale = imgScale + delta;
        newScale = Math.min(Math.max(0.5, newScale), 5);
        imgScale = newScale;
        updateImageTransform();
    }, {passive: false});

    function togglePlanOverviewContainer() {
        const el = document.getElementById('plan-overview-container');
        if (el) {
            if (el.style.display === 'none') {
                el.style.display = 'block';
                updatePlanOverviewStats();
            } else {
                el.style.display = 'none';
            }
        }
    }

    function updatePlanOverviewStats() {
        let plans = [];
        try {
            plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
        } catch (e) {
            console.error('Error loading plans for stats:', e);
        }
        
        const getRealCount = (list) => {
            let count = 0;
            list.forEach(p => {
                if (p.subPlans && p.subPlans.length > 0) {
                    count += getRealCount(p.subPlans);
                } else {
                    count++;
                }
            });
            return count;
        };

        const getRealTime = (list) => {
            let t = 0;
            list.forEach(p => {
                if (p.subPlans && p.subPlans.length > 0) {
                    t += getRealTime(p.subPlans);
                } else {
                    if(p.status === 'completed') {
                        t += parseTimeSpentToHours(p.timeSpent);
                    }
                }
            });
            return t;
        };

        const activeList = plans.filter(p => (p.status || 'active') === 'active');
        const completedList = plans.filter(p => (p.status || 'active') === 'completed');

        const planPending = getRealCount(activeList);
        const planCompleted = getRealCount(completedList);
        const planTotal = planPending + planCompleted;
        const planTime = getRealTime(plans);

        const elPlanTotal = document.getElementById('stats-plan-total');
        if(elPlanTotal) elPlanTotal.textContent = planTotal;
        
        const elPlanCompleted = document.getElementById('stats-plan-completed');
        if(elPlanCompleted) elPlanCompleted.textContent = planCompleted;
        
        const elPlanPending = document.getElementById('stats-plan-pending');
        if(elPlanPending) elPlanPending.textContent = planPending;

        const elPlanTime = document.getElementById('stats-plan-time');
        if(elPlanTime) elPlanTime.textContent = planTime.toFixed(1);

        // Update UI state based on planChartConfig
        const setMetricActive = (id, active, color) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (active) {
                el.style.border = `2px solid ${color}`;
                el.style.background = '#f9f9f9';
            } else {
                el.style.border = '2px solid transparent';
                el.style.background = 'transparent';
            }
        };

        setMetricActive('metric-total', planChartConfig.total, '#4a90e2');
        setMetricActive('metric-completed', planChartConfig.completed, '#52c41a');
        setMetricActive('metric-pending', planChartConfig.pending, '#faad14');
        setMetricActive('metric-time', planChartConfig.time, '#722ed1');

        renderPlanChart(plans);
    }

</script>
