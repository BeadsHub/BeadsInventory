// ==================== Shopping List Logic ====================

let currentShoppingListSort = 'code'; // 'code' or 'bags'
let currentShoppingListFilter = 'all'; // 'all' or 'unpurchased'

/**
 * Generate Shopping List
 * @param {Array} providedShortages - Optional. If provided (from aggregateActivePlanRequirements), use it.
 * Structure of providedShortages: [{ code, missingQty }] where missingQty is GRAMS.
 */
function generateShoppingList(providedShortages = null) {
    let deficits = [];

    if (providedShortages) {
        // Use provided global shortages (Grams)
        // 1 bag = 10g
        deficits = providedShortages.map(item => {
            const bead = data.find(d => d.id === item.code);
            const missingGrams = parseFloat(item.missingQty);
            const bags = Math.ceil(missingGrams / 10);
            
            // Get pending status
            const pendingBags = bead.pendingBags || 0;
            
            return {
                code: item.code,
                missing: missingGrams.toFixed(1) + 'g', // Display as grams
                bags: bags,
                hex: bead ? bead.hex : '#eee',
                name: bead ? bead.n : '',
                pendingBags: pendingBags,
                isPending: pendingBags > 0 && pendingBags >= bags
            };
        });
    } else {
        if (!currentPlanId) return;
        // Legacy support removed
        return; 
    }

    if (deficits.length === 0) {
        showToast('库存充足，无需补货！');
        return;
    }

    // Open Modal
    openShoppingListModal(deficits);
}

function openShoppingListModal(deficits) {
    let modal = document.getElementById('shoppingListModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shoppingListModal';
        modal.className = 'modal';
        modal.style.cssText = 'width: 90%; max-width: 400px; height: 85vh; max-height: 700px; display: none; flex-direction: column; padding: 0; overflow: hidden; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 1040;';
        document.body.appendChild(modal);
    }

    // Filter Deficits
    let displayDeficits = deficits;
    if (currentShoppingListFilter === 'unpurchased') {
        displayDeficits = deficits.filter(d => !d.isPending);
    }

    // Sort Deficits
    const sortedDeficits = [...displayDeficits];
    if (currentShoppingListSort === 'bags') {
        sortedDeficits.sort((a, b) => b.bags - a.bags);
    } else {
        // Natural sort for codes
        sortedDeficits.sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true, sensitivity: 'base'}));
    }

    const totalBags = deficits.reduce((sum, item) => sum + item.bags, 0);
    const pendingCount = deficits.filter(d => d.isPending).length;

    modal.innerHTML = `
        <div style="padding: 24px 20px 16px; background: white; border-bottom: 1px solid #f0f0f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #333;">🛒 补货清单</h3>
                <button onclick="closeAllModals()" style="background:none; border:none; color:#999; font-size:24px; padding:0; line-height:1; cursor:pointer;">&times;</button>
            </div>
            
            <div style="display:flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 13px; color: #666;">
                    共需补 <b style="color:#cf1322">${deficits.length}</b> 色 / <b style="color:#cf1322">${totalBags}</b> 包
                    ${pendingCount > 0 ? `<span style="color:#52c41a; margin-left:5px;">(已购 ${pendingCount} 色)</span>` : ''}
                    <div style="font-size:11px; color:#999; margin-top:4px;">(按 1包=10g 估算)</div>
                </div>
                
                <div style="display:flex; gap:6px; align-self: flex-end;">
                    <button onclick="toggleShoppingListFilter()" style="font-size:12px; padding:4px 8px; border-radius:12px; border:1px solid #eee; background:${currentShoppingListFilter === 'unpurchased' ? '#ffccc7' : 'white'}; color:${currentShoppingListFilter === 'unpurchased' ? '#cf1322' : '#666'}; cursor:pointer; white-space:nowrap;">
                        ${currentShoppingListFilter === 'unpurchased' ? '只看未买' : '显示全部'}
                    </button>
                    <button onclick="toggleShoppingListSort('code')" style="font-size:12px; padding:4px 8px; border-radius:12px; border:1px solid #eee; background:${currentShoppingListSort === 'code' ? '#e6f7ff' : 'white'}; color:${currentShoppingListSort === 'code' ? '#1890ff' : '#666'}; cursor:pointer; white-space:nowrap;">按色号</button>
                    <button onclick="toggleShoppingListSort('bags')" style="font-size:12px; padding:4px 8px; border-radius:12px; border:1px solid #eee; background:${currentShoppingListSort === 'bags' ? '#e6f7ff' : 'white'}; color:${currentShoppingListSort === 'bags' ? '#1890ff' : '#666'}; cursor:pointer; white-space:nowrap;">按缺量</button>
                </div>
            </div>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 15px; background: #f5f7fa;">
            ${sortedDeficits.length > 0 ? sortedDeficits.map(item => renderShoppingItem(item)).join('') : '<div style="text-align:center; padding:30px; color:#999;">无符合条件的项目</div>'}
        </div>

        <div style="padding: 16px; background: white; border-top: 1px solid #f0f0f0; display:flex; gap:10px;">
            <button onclick="copyShoppingList()" style="flex:1; padding:12px; background:#eb2f96; color:white; border:none; border-radius:12px; font-weight:bold; font-size:16px; box-shadow:0 4px 12px rgba(235, 47, 150, 0.3); cursor:pointer;">
                📋 复制清单
            </button>
        </div>
    `;

    document.getElementById('shoppingListModal').style.display = 'flex';
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'block';
    
    // Store for refresh
    modal.dataset.deficits = JSON.stringify(deficits);
}

function renderShoppingItem(item) {
    const isPending = item.isPending;
    
    return `
        <div class="shopping-item ${isPending ? 'is-pending' : ''}" data-code="${item.code}" style="display:flex; align-items:center; padding:16px; background:${isPending ? '#f6ffed' : 'white'}; margin-bottom:12px; border-radius:16px; border:1px solid ${isPending ? '#b7eb8f' : '#eaeff5'}; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: all 0.2s; opacity: ${isPending ? '0.8' : '1'};">
            <!-- Checkbox Area -->
            <div style="margin-right:15px; display:flex; flex-direction:column; align-items:center; gap:4px;">
                <div onclick="toggleShoppingItemStatus('${item.code}', ${item.bags}, this)" 
                     style="width:28px; height:28px; border:2px solid ${isPending ? '#52c41a' : '#ddd'}; background:${isPending ? '#52c41a' : 'white'}; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; font-size:18px; transition:all 0.2s;">
                    ${isPending ? '✓' : ''}
                </div>
                <div style="font-size:10px; color:${isPending ? '#52c41a' : '#999'};">${isPending ? '在途' : '缺货'}</div>
            </div>
            
            <!-- Color Info -->
            <div style="position:relative; width:44px; height:44px; border-radius:50%; background:${item.hex}; border:2px solid #fff; box-shadow:0 0 0 1px #ddd; margin-right:15px; flex-shrink:0;">
                ${item.isPending ? `
                <div onclick="confirmRestock('${item.code}', ${item.bags})" style="position:absolute; bottom:-4px; right:-4px; background:#1890ff; color:white; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid white; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                    📥
                </div>
                ` : ''}
            </div>
            
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:17px; color:#333; margin-bottom:2px;">
                    ${item.code} 
                    <span style="font-weight:normal; font-size:13px; color:#999; margin-left:4px;">${item.name || ''}</span>
                </div>
                <div style="font-size:12px; color:${isPending ? '#999' : '#cf1322'};">
                    ${isPending ? `已购 ${item.bags} 包` : `缺 ${item.missing}`}
                </div>
            </div>
            
            <!-- Bag Count -->
            <div style="text-align:right;">
                ${isPending ? `
                    <button onclick="confirmRestock('${item.code}', ${item.bags})" style="background:#1890ff; color:white; border:none; padding:4px 10px; border-radius:12px; font-size:12px; cursor:pointer;">
                        到货
                    </button>
                ` : `
                    <div style="font-weight:bold; font-size:20px; color:#eb2f96;">x${item.bags}</div>
                    <div style="font-size:10px; color:#999;">包</div>
                `}
            </div>
        </div>
    `;
}

function toggleShoppingListSort(sortType) {
    if (currentShoppingListSort === sortType) return;
    currentShoppingListSort = sortType;
    
    // Refresh modal
    const modal = document.getElementById('shoppingListModal');
    if (modal && modal.dataset.deficits) {
        const deficits = JSON.parse(modal.dataset.deficits);
        openShoppingListModal(deficits);
    }
}

function getShoppingDateFormat(now) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}:${s}`;
}

function toggleShoppingListFilter() {
    currentShoppingListFilter = (currentShoppingListFilter === 'all') ? 'unpurchased' : 'all';
    
    // Refresh modal
    const modal = document.getElementById('shoppingListModal');
    if (modal && modal.dataset.deficits) {
        const deficits = JSON.parse(modal.dataset.deficits);
        openShoppingListModal(deficits);
    }
}

function toggleShoppingItemStatus(code, bags, checkboxEl) {
    const bead = data.find(d => d.id === code);
    if (!bead) return;
    
    // Toggle Pending Status
    if (bead.pendingBags && bead.pendingBags > 0) {
        // Cancel Pending
        bead.pendingBags = 0;
        showToast(`${code} 已取消在途标记`);
    } else {
        // Set Pending
        bead.pendingBags = bags;
        showToast(`${code} 已标记为在途`);
    }
    
    saveData();
    
    // Refresh Modal Logic
    // We need to update the deficits list stored in modal
    const modal = document.getElementById('shoppingListModal');
    if (modal && modal.dataset.deficits) {
        let deficits = JSON.parse(modal.dataset.deficits);
        const item = deficits.find(d => d.code === code);
        if (item) {
            item.isPending = (bead.pendingBags > 0);
            item.pendingBags = bead.pendingBags;
        }
        modal.dataset.deficits = JSON.stringify(deficits); // Update stored data
        openShoppingListModal(deficits); // Re-render
    }
}

function confirmRestock(code, bags) {
    const bead = data.find(d => d.id === code);
    if (!bead) return;
    
    // Ensure bags is a valid number
    const bagsNum = parseFloat(bags);
    if (isNaN(bagsNum) || bagsNum <= 0) {
        showToast('补货数量无效');
        return;
    }

    const addWeight = parseFloat((bagsNum * 10).toFixed(2));

    showConfirmModal(
        "到货入库确认", 
        `确认色号 ${code} 已到货 ${bagsNum} 包 (约${addWeight}g)？\n将自动增加库存并清除在途标记。`,
        () => {
            // Debug info: Log current weight
            const oldWeight = parseFloat(bead.w) || 0;
            
            // Update Inventory
            bead.w = parseFloat((oldWeight + addWeight).toFixed(2));
            
            // Add Log
            if (!bead.logs) bead.logs = [];
            
            // Use local date format helper
            const dateStr = getShoppingDateFormat(new Date());
            
            bead.logs.push({
                d: dateStr,
                val: addWeight,
                type: 'add',
                note: '补货单入库'
            });

            // Update Total Added Stats
            if (bead.totalAdded !== undefined) {
                bead.totalAdded = parseFloat(((bead.totalAdded || 0) + addWeight).toFixed(2));
            } else {
                 bead.totalAdded = addWeight;
            }
            
            // Clear Pending
            bead.pendingBags = 0;
            
            // Force Save
            saveData();
            
            // Feedback with weight change to verify
            showToast(`${code} 入库成功 (+${addWeight}g)\n库存: ${oldWeight}g ➜ ${bead.w}g`.replace(/\n/g, ' '));
            
            // Refresh Main UI
            if (typeof render === 'function') {
                render();
            }
            
            // Refresh Stats UI if exists
            if (typeof updateStats === 'function') {
                updateStats();
            }

            // Refresh Shopping List Modal
            const modal = document.getElementById('shoppingListModal');
            if (modal && modal.dataset.deficits) {
                let deficits = JSON.parse(modal.dataset.deficits);
                
                // Remove the restocked item from the shopping list view
                const idx = deficits.findIndex(d => d.code === code);
                if (idx !== -1) {
                    deficits.splice(idx, 1);
                }
                
                if (deficits.length === 0) {
                    closeAllModals();
                    showToast('所有补货已完成！');
                } else {
                    // Update dataset and re-render
                    modal.dataset.deficits = JSON.stringify(deficits);
                    openShoppingListModal(deficits);
                }
            }
            
            // Also refresh main plan list if needed (to update shortage warnings)
            if (typeof renderPlans === 'function') {
                renderPlans();
            }
        }
    );
}

function saveData() {
    localStorage.setItem('bead_v_sort', JSON.stringify(data));
}

function copyShoppingList() {
    const modal = document.getElementById('shoppingListModal');
    if (!modal || !modal.dataset.deficits) return;
    
    const deficits = JSON.parse(modal.dataset.deficits);
    
    // Filter out pending ones? Or include them? User usually wants to copy what they need to buy.
    // If it's pending, they already bought it. So maybe exclude pending?
    // Let's exclude pending items from the copy text by default, or mark them.
    // Requirement: "勾选后即标记该缺货色号为”在途“" -> implied they bought it.
    // So copying should probably only copy "Not Pending" ones.
    
    const toBuy = deficits.filter(d => !d.isPending);
    
    if (toBuy.length === 0) {
        showToast('没有待购买的项 (其他都在途)');
        return;
    }
    
    const lines = toBuy.map(d => `${d.code} x ${d.bags}包`);
    const text = `老板，我要买这些：\n${lines.join('\n')}\n(共 ${toBuy.reduce((s,i)=>s+i.bags,0)} 包)`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制待购清单');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制待购清单');
    }
}
