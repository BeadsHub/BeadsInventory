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
