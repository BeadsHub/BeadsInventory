
// Cat Inventory Management

let catInventory = [];
let catLogs = [];
let selectedCatCategories = new Set();
let currentCatLogFilter = 'all';
let currentCatSort = 'expiry_asc';
let currentCatLogDateRange = 'all';
let selectedLogCategories = new Set();

// Initialize Data
function initCatData() {
    const storedInv = localStorage.getItem('cat_inventory');
    if (storedInv) {
        catInventory = JSON.parse(storedInv);
    }

    const storedLogs = localStorage.getItem('cat_logs');
    if (storedLogs) {
        catLogs = JSON.parse(storedLogs);
    }
}

// Save Data
function saveCatData() {
    localStorage.setItem('cat_inventory', JSON.stringify(catInventory));
    localStorage.setItem('cat_logs', JSON.stringify(catLogs));
}

// Add Item (Inbound)
function addCatItem(item) {
    const newItem = {
        id: Date.now().toString(),
        name: item.name,
        category: item.category, // e.g., 'Food', 'Toy', 'Health', 'Other'
        value: parseFloat(item.value) || 0,
        brand: item.brand || '',
        specValue: item.specValue ? String(item.specValue) : '',
        specUnit: item.specUnit ? String(item.specUnit) : '',
        packageUnit: item.packageUnit ? String(item.packageUnit) : '',
        productionDate: item.productionDate,
        purchaseDate: new Date().toISOString().split('T')[0], // Auto-record today
        quantity: parseInt(item.quantity) || 1,
        status: 'active'
    };

    newItem.expiryDate = item.expiryDate || '';

    catInventory.push(newItem);
    
    // Add Log
    const specText = (newItem.specValue && newItem.specUnit) ? ` · 规格: ${newItem.specValue}${newItem.specUnit}` : '';
    const inName = newItem.brand ? `${newItem.brand} - ${newItem.name}` : newItem.name;
    addCatLog('inbound', inName, `入库: ${newItem.quantity}${newItem.packageUnit ? ' ' + newItem.packageUnit : ''} ${newItem.category}${specText}, 价值: ${newItem.value}`, newItem.category);
    
    saveCatData();
    renderCatInventory();
    showToast('入库成功');
}

// Consume Item (Outbound)
function consumeCatItem(id) {
    const itemIndex = catInventory.findIndex(i => i.id === id);
    if (itemIndex === -1) return;

    const item = catInventory[itemIndex];
    
    // Logic: Reduce quantity by 1. If 0, remove or mark as consumed.
    // User requirement: "Deduct inventory". 
    // Assuming simple -1 for now, or remove if quantity is 1.
    
    if (item.quantity > 1) {
        item.quantity--;
        const outName = item.brand ? `${item.brand} - ${item.name}` : item.name;
        const specText = (item.specValue && item.specUnit) ? ` · 规格: ${item.specValue}${item.specUnit}` : '';
        addCatLog('outbound', outName, `出库 1${item.packageUnit ? ' ' + item.packageUnit : ''}${specText}, 剩余 ${item.quantity}${item.packageUnit ? ' ' + item.packageUnit : ''}`, item.category);
    } else {
        // Remove item
        catInventory.splice(itemIndex, 1);
        const outName2 = item.brand ? `${item.brand} - ${item.name}` : item.name;
        const specText2 = (item.specValue && item.specUnit) ? ` · 规格: ${item.specValue}${item.specUnit}` : '';
        addCatLog('outbound', outName2, `出库 1${item.packageUnit ? ' ' + item.packageUnit : ''}${specText2}, 已移除`, item.category);
    }

    saveCatData();
    renderCatInventory();
    showToast(`出库 1${item.packageUnit ? ' ' + item.packageUnit : ''} 成功`);
}

// Add Log
function addCatLog(type, name, note) {
    const log = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: type, // 'inbound', 'outbound'
        itemName: name,
        date: new Date().toISOString(), // Full timestamp
        note: note,
        category: arguments[3] || ''
    };
    catLogs.unshift(log); // Add to top
    saveCatData();
    // If logs tab is active, render logs
    if (document.getElementById('cat-tab-logs').classList.contains('active')) {
        renderCatLogs();
    }
}

// Render Inventory
function renderCatInventory() {
    const listEl = document.getElementById('catInventoryList');
    if (!listEl) return;

    const searchTerm = document.getElementById('catSearch').value.toLowerCase();
    const sortType = currentCatSort; // 'expiry_asc', 'date_desc'
    const normalizeCategory = (s) => {
        if (!s) return '';
        if (s.includes('猫砂')) return '猫砂';
        if (s.includes('罐头')) return '罐头';
        return s;
    };

    let filtered = catInventory.filter(item => {
        const matchText = item.name.toLowerCase().includes(searchTerm) || 
               item.category.toLowerCase().includes(searchTerm);
        const matchCat = (selectedCatCategories.size === 0) || selectedCatCategories.has(item.category);
        return matchText && matchCat;
    });

    // Sorting
    if (sortType === 'expiry_asc') {
        filtered.sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate) - new Date(b.expiryDate);
        });
    } else if (sortType === 'date_desc') {
        filtered.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    }

    // Summary Bar
    const summaryEl = document.getElementById('catSummaryBar');
    const cEl = document.getElementById('catSummaryCount');
    const qEl = document.getElementById('catSummaryQty');
    const nEl = document.getElementById('catSummaryNear');
    const expBtn = document.getElementById('catSortExpiryBtn');
    const dateBtn = document.getElementById('catSortDateBtn');
    if (summaryEl && cEl && qEl && nEl) {
        const totalItems = filtered.length;
        const totalQty = filtered.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0);
        const near30 = filtered.filter(it => {
            if (!it.expiryDate) return false;
            const d = Math.ceil((new Date(it.expiryDate) - new Date()) / (1000*60*60*24));
            return d >= 0 && d <= 30;
        }).length;
        cEl.textContent = `条目: ${totalItems}`;
        qEl.textContent = `总数量: ${totalQty}`;
        nEl.textContent = `近到期(≤30天): ${near30}`;
        summaryEl.style.display = 'block';
        if (expBtn && dateBtn) {
            const setActive = (el, active) => {
                el.style.background = active ? '#e6f7ff' : '#f5f5f5';
                el.style.color = active ? '#1890ff' : '#666';
                el.style.borderColor = active ? '#91d5ff' : '#ddd';
            };
            setActive(expBtn, sortType === 'expiry_asc');
            setActive(dateBtn, sortType === 'date_desc');
        }
    }
    // Category Aggregation Stats
    const statsEl = document.getElementById('catCategoryStats');
    if (statsEl) {
        const normalizeCategory = (s) => {
            if (!s) return '';
            if (s.includes('猫砂')) return '猫砂';
            if (s.includes('罐头')) return '罐头/零食';
            return s;
        };
        const toKg = (val, unit) => {
            const v = parseFloat(val || 0);
            if (!unit) return 0;
            if (unit === 'kg') return v;
            if (unit === 'g') return v / 1000;
            return 0;
        };
        const statsMap = new Map();
        filtered.forEach(it => {
            const cat = normalizeCategory(it.category);
            if (!statsMap.has(cat)) {
                statsMap.set(cat, { units: { '包':0, '盒':0, '罐':0, '个':0 }, weightKg:0, entries:0 });
            }
            const st = statsMap.get(cat);
            const qty = parseInt(it.quantity) || 0;
            st.entries += 1;
            if (it.packageUnit && st.units[it.packageUnit] !== undefined) {
                st.units[it.packageUnit] += qty;
            }
            st.weightKg += qty * toKg(it.specValue, it.specUnit);
        });
        if (statsMap.size > 0) {
            let html = '';
            statsMap.forEach((st, cat) => {
                const unitBadges = Object.entries(st.units)
                    .filter(([,count]) => count > 0)
                    .map(([u,c]) => `<span style="font-size:12px; background:#fff; color:#555; padding:2px 8px; border-radius:10px; border:1px solid #eee;">${u}×${c}</span>`)
                    .join(' ');
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:bold; font-size:13px; color:#1d39c4;">${cat}</span>
                            <span style="font-size:12px; color:#999;">条目×${st.entries}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${unitBadges || '<span style="font-size:12px; color:#bbb;">无单位统计</span>'}
                            <span style="font-size:12px; background:#f6ffed; color:#389e0d; padding:2px 8px; border-radius:10px; border:1px solid #b7eb8f;">重量≈${st.weightKg.toFixed(2)}kg</span>
                        </div>
                    </div>
                `;
            });
            statsEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="font-weight:bold; color:#0050b3;">分类统计</div>
                    <div style="font-size:12px; color:#999;">基于当前筛选</div>
                </div>
                ${html}
            `;
            statsEl.style.display = 'block';
        } else {
            statsEl.style.display = 'none';
        }
    }

    listEl.innerHTML = '';

    if (filtered.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#999; padding:40px;">暂无物品</div>';
        return;
    }

    filtered.forEach(item => {
        let expiryText = '';
        let expiryColor = '#666';
        if (item.expiryDate) {
            const today = new Date();
            const exp = new Date(item.expiryDate);
            const diffTime = exp - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays < 0) {
                expiryText = `已过期 ${Math.abs(diffDays)} 天`;
                expiryColor = 'red';
            } else if (diffDays <= 30) {
                expiryText = `剩 ${diffDays} 天过期`;
                expiryColor = 'orange';
            } else {
                expiryText = `保质期至: ${item.expiryDate}`;
            }
        } else {
            expiryText = '无保质期信息';
        }

        const card = document.createElement('div');
        const isNearExpiry = item.expiryDate ? (() => {
            const today = new Date();
            const exp = new Date(item.expiryDate);
            const diffTime = exp - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return (diffDays >= 0 && diffDays <= 30) ? diffDays : null;
        })() : null;
        card.style.cssText = `background: transparent; margin-bottom: 12px; position: relative; overflow: hidden; height: auto; border-radius: 12px;`;

        const actions = [
            { text: '复制', bg: '#1890ff', click: () => { duplicateCatItem(item.id); resetSwipe(); } },
            { text: '删除', bg: '#ff4d4f', click: () => { confirmDeleteCatItem(item.id); } }
        ];
        const actionBtnWidth = 64;
        const totalActionWidth = actions.length * actionBtnWidth;
        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = 'position: absolute; right: 0; display: flex; z-index: 1; border-radius: 0 12px 12px 0; overflow: hidden; visibility: hidden;';
        actionsContainer.innerHTML = actions.map(a => `
            <div style="width:${actionBtnWidth}px; height:100%; background:${a.bg}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px;">${a.text}</div>
        `).join('');
        const actionBtns = actionsContainer.querySelectorAll('div');
        actionBtns.forEach((btn, i) => { btn.onclick = (e) => { e.stopPropagation(); actions[i].click(); }; });
        card.appendChild(actionsContainer);

        if (isNearExpiry) {
            const tip = document.createElement('div');
            tip.style.cssText = 'margin: 0 12px 6px 12px; font-size: 12px; color: #cf1322;';
            tip.textContent = `${isNearExpiry} 天到期`;
            card.appendChild(tip);
        }

        const inner = document.createElement('div');
        inner.style.cssText = `background: ${isNearExpiry ? '#fff0f6' : 'white'}; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; z-index: 2; transition: transform 0.2s ease-out; border: 1px solid ${isNearExpiry ? '#ffadd2' : '#f0f0f0'}; width: 100%; box-sizing: border-box; display: flex; align-items: stretch;`;

        const left = document.createElement('div');
        left.style.cssText = 'flex: 1; min-width: 0;';
        left.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden;">
                <span style="font-weight:bold; font-size:16px; color:#333;">${item.brand ? `${item.brand} - ${item.name}` : item.name}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden;">
                <span style="background:#f5f5f5; color:#666; padding:2px 8px; border-radius:10px; font-size:12px;">x${item.quantity}${item.packageUnit ? ' ' + item.packageUnit : ''}</span>
                ${item.specValue && item.specUnit ? `<span style="background:#fff7e6; color:#fa8c16; padding:2px 8px; border-radius:10px; font-size:12px;">${item.specValue}${item.specUnit}</span>` : ''}
                <span style="background:#fff5f5; color:#d4380d; padding:2px 8px; border-radius:10px; font-size:12px;">¥${item.value}</span>
            </div>
            <div style="font-size:12px; color:#666;">购入: ${item.purchaseDate || '-'}</div>
            <div style="font-size:12px; color:#666;">到期: ${item.expiryDate || '-'}</div>
        `;

        const consumeBtn = document.createElement('div');
        consumeBtn.style.cssText = 'width:28px; height:28px; background:#52c41a; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; cursor:pointer; box-shadow:0 2px 6px rgba(82,196,26,0.3);';
        consumeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>';
        consumeBtn.onclick = (e) => { e.stopPropagation(); consumeCatItem(item.id); };

        const right = document.createElement('div');
        right.style.cssText = 'display:flex; flex-direction:column; align-items:flex-end; gap:6px;';
        const catChip = document.createElement('div');
        catChip.style.cssText = 'align-self:flex-end; background:#f0f7ff; color:#4a90e2; padding:2px 8px; border-radius:10px; font-size:12px;';
        catChip.textContent = normalizeCategory(item.category);
        right.appendChild(catChip);
        right.appendChild(consumeBtn);

        inner.appendChild(left);
        inner.appendChild(right);
        card.appendChild(inner);
        // Open detail modal on click (edit in detail)
        inner.onclick = (e) => {
            // avoid when clicking action buttons
            if (e.target.closest('.m-btn') || e.target.closest('svg')) {
                // if it's consume button svg, its parent has no .m-btn; we still allow consume action
                // clicking non-consume svg shouldn't open detail
                return;
            }
            if (isOpened) { resetSwipe(); return; }
            openCatDetail(item.id);
        };

        listEl.appendChild(card);
        requestAnimationFrame(() => {
            actionsContainer.style.top = inner.offsetTop + 'px';
            actionsContainer.style.height = inner.offsetHeight + 'px';
        });

        let startX = 0, startY = 0, currentX = 0, isOpened = false, isMouseDown = false;
        inner.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
        }, {passive:true});
        inner.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            let deltaX = currentX - startX;
            const deltaY = currentY - startY;
            if (Math.abs(deltaY) > Math.abs(deltaX)) return;
            if (isOpened) deltaX -= totalActionWidth;
            deltaX = Math.max(-totalActionWidth, Math.min(0, deltaX));
            inner.style.transform = `translateX(${deltaX}px)`;
            actionsContainer.style.visibility = Math.abs(deltaX) > 10 ? 'visible' : 'hidden';
        }, {passive:true});
        inner.addEventListener('touchend', (e) => {
            const deltaX = e.changedTouches[0].clientX - startX;
            if (!isOpened && deltaX < -30) { inner.style.transform = `translateX(-${totalActionWidth}px)`; isOpened = true; actionsContainer.style.visibility = 'visible'; }
            else if (isOpened) { inner.style.transform = `translateX(-${totalActionWidth}px)`; actionsContainer.style.visibility = 'visible'; }
            else { inner.style.transform = 'translateX(0)'; isOpened = false; actionsContainer.style.visibility = 'hidden'; }
        });
        inner.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            currentX = startX;
            isMouseDown = true;
        });
        inner.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            currentX = e.clientX;
            const currentY = e.clientY;
            let deltaX = currentX - startX;
            const deltaY = currentY - startY;
            if (Math.abs(deltaY) > Math.abs(deltaX)) return;
            if (isOpened) deltaX -= totalActionWidth;
            deltaX = Math.max(-totalActionWidth, Math.min(0, deltaX));
            inner.style.transform = `translateX(${deltaX}px)`;
            actionsContainer.style.visibility = Math.abs(deltaX) > 10 ? 'visible' : 'hidden';
        });
        inner.addEventListener('mouseup', (e) => {
            if (!isMouseDown) return;
            isMouseDown = false;
            const deltaX = e.clientX - startX;
            if (!isOpened && deltaX < -20) { inner.style.transform = `translateX(-${totalActionWidth}px)`; isOpened = true; actionsContainer.style.visibility = 'visible'; }
            else if (isOpened) { inner.style.transform = `translateX(-${totalActionWidth}px)`; actionsContainer.style.visibility = 'visible'; }
            else { inner.style.transform = 'translateX(0)'; isOpened = false; actionsContainer.style.visibility = 'hidden'; }
        });
        // Do not auto-close on mouseleave to allow clicking actions
        inner.addEventListener('mouseleave', () => { isMouseDown = false; });

        window.addEventListener('resize', () => {
            actionsContainer.style.top = inner.offsetTop + 'px';
            actionsContainer.style.height = inner.offsetHeight + 'px';
        });

        function resetSwipe() { inner.style.transform = 'translateX(0)'; isOpened = false; actionsContainer.style.visibility = 'hidden'; }
    });
}

// Render Logs
function renderCatLogs() {
    const listEl = document.getElementById('catLogList');
    if (!listEl) return;

    listEl.innerHTML = '';
    
    const normalizeCat = (s) => {
        if (!s) return '';
        if (s.includes('猫砂')) return '猫砂';
        if (s.includes('罐头')) return '罐头';
        return s;
    };
    const selectedNorm = new Set(Array.from(selectedLogCategories).map(normalizeCat));

    const filteredLogs = catLogs.filter(l => {
        // Type filter
        if (currentCatLogFilter !== 'all' && l.type !== currentCatLogFilter) return false;
        // Date filter
        const d = new Date(l.date);
        const today = new Date();
        const isSameDay = d.getFullYear() === today.getFullYear() &&
                          d.getMonth() === today.getMonth() &&
                          d.getDate() === today.getDate();
        const diffDays = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / (1000*60*60*24));
        const isSameMonth = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
        if (currentCatLogDateRange === 'today') return isSameDay;
        if (currentCatLogDateRange === 'last7') return diffDays >= 0 && diffDays <= 7;
        if (currentCatLogDateRange === 'month') return isSameMonth;
        // Category filter (normalized)
        if (selectedNorm.size > 0) {
            return selectedNorm.has(normalizeCat(l.category || ''));
        }
        return true;
    });

    // Update filter chip styles
    const setChip = (id, active) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.background = active ? '#e6f7ff' : '#f5f5f5';
        el.style.color = active ? '#1890ff' : '#666';
        el.style.borderColor = active ? '#91d5ff' : '#ddd';
    };
    setChip('catLogFilterAll', currentCatLogFilter === 'all');
    setChip('catLogFilterOutbound', currentCatLogFilter === 'outbound');
    setChip('catLogFilterInbound', currentCatLogFilter === 'inbound');
    setChip('catLogDateAll', currentCatLogDateRange === 'all');
    setChip('catLogDateToday', currentCatLogDateRange === 'today');
    setChip('catLogDate7', currentCatLogDateRange === 'last7');
    setChip('catLogDateMonth', currentCatLogDateRange === 'month');
    // Category chips
    const logChips = document.querySelectorAll('.log-cat-chip');
    logChips.forEach(chip => {
        const cat = chip.getAttribute('data-log-cat');
        const active = (selectedLogCategories.size === 0 && cat === 'all') || (cat !== 'all' && selectedLogCategories.has(cat));
        chip.style.background = active ? '#e6f7ff' : '#f5f5f5';
        chip.style.borderColor = active ? '#91d5ff' : '#ddd';
        chip.style.color = active ? '#1890ff' : '#666';
    });

    if (filteredLogs.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#999; padding:40px;">暂无记录</div>';
        return;
    }

    // Group by date (YYYY-MM-DD)
    const groups = {};
    filteredLogs.forEach(l => {
        const d = new Date(l.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(l);
    });

    Object.keys(groups).sort((a,b) => new Date(b) - new Date(a)).forEach(day => {
        const header = document.createElement('div');
        header.style.cssText = 'padding:8px 12px; background:#fafafa; border:1px solid #eee; border-radius:10px; margin:10px 0 6px; color:#666; font-size:12px;';
        header.textContent = day;
        listEl.appendChild(header);

        groups[day].forEach(log => {
            const dateObj = new Date(log.date);
            const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const isIn = log.type === 'inbound';
            const badgeBg = isIn ? '#f6ffed' : '#fff0f6';
            const badgeColor = isIn ? '#52c41a' : '#eb2f96';
            const catLabel = normalizeCat(log.category || '');

            const item = document.createElement('div');
            item.style.cssText = 'background:white; border:1px solid #f0f0f0; border-radius:10px; padding:10px 12px; display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;';
            item.innerHTML = `
                <div style="min-width:48px; text-align:center;">
                    <div style="font-size:12px; color:#999;">${timeStr}</div>
                    <div style="margin-top:6px; font-size:12px; background:${badgeBg}; color:${badgeColor}; padding:2px 6px; border-radius:10px; border:1px solid ${isIn ? '#b7eb8f' : '#ffadd2'};">${isIn ? '入库' : '出库'}</div>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#333; margin-bottom:4px;">${log.itemName}</div>
                    ${catLabel ? `<div style="margin-bottom:4px;"><span style="font-size:12px; background:#f0f7ff; color:#4a90e2; padding:2px 8px; border-radius:10px; border:1px solid #d6e4ff;">${catLabel}</span></div>` : ''}
                    <div style="font-size:13px; color:#666;">${log.note}</div>
                </div>
            `;
            listEl.appendChild(item);
        });
    });
}

function setCatLogFilter(type) {
    currentCatLogFilter = type;
    renderCatLogs();
}

function setCatLogDateRange(range) {
    currentCatLogDateRange = range;
    renderCatLogs();
}

function setCatSort(type) {
    currentCatSort = type;
    renderCatInventory();
}

function toggleLogCategory(cat) {
    if (cat === 'all') {
        selectedLogCategories.clear();
    } else {
        if (selectedLogCategories.has(cat)) selectedLogCategories.delete(cat);
        else selectedLogCategories.add(cat);
    }
    renderCatLogs();
}

function toggleCatLogsFilterPanel() {
    const panel = document.getElementById('catLogsFilterPanel');
    if (!panel) return;
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
}

// UI Handlers
function openCatAddModal() {
    showModal('catAddModal');
    const mask = document.getElementById('mask');
    if (mask) { 
        mask.style.zIndex = '100000'; 
        mask.style.backdropFilter = 'blur(8px)'; 
        mask.style.webkitBackdropFilter = 'blur(8px)'; 
    }
    const modal = document.getElementById('catAddModal');
    if (modal) { 
        modal.style.zIndex = '100001'; 
        modal.style.position = 'fixed'; 
        modal.style.left = '50%'; 
        modal.style.top = '50%'; 
        modal.style.transform = 'translate(-50%, -50%)'; 
    }
    applyAddCategoryDefaults();
    attachDatePickerHelpers();
}

function closeCatAddModal() {
    closeAllModals();
}

function submitCatAdd() {
    const name = document.getElementById('catAddName').value.trim();
    const category = document.getElementById('catAddCategory').value;
    const value = document.getElementById('catAddValue').value;
    const brand = document.getElementById('catAddBrand').value.trim();
    const specValue = document.getElementById('catAddSpecValue').value;
    const specUnit = document.getElementById('catAddSpecUnit').value;
    const packageUnit = document.getElementById('catAddPackageUnit') ? document.getElementById('catAddPackageUnit').value : '';
    const prodDate = document.getElementById('catAddProdDate').value;
    const expiryDate = document.getElementById('catAddExpiryDate').value;
    const quantity = document.getElementById('catAddQuantity').value;

    if (!name) {
        showToast('请输入物品名称');
        return;
    }

    const finalPackageUnit = (category === '罐头') ? '罐' : (category === '猫砂') ? '包' : packageUnit;
    addCatItem({
        name,
        category,
        value,
        specValue,
        specUnit,
        packageUnit: finalPackageUnit,
        brand,
        productionDate: prodDate,
        expiryDate,
        quantity
    });

    closeCatAddModal();
    // Reset form
    document.getElementById('catAddName').value = '';
    document.getElementById('catAddValue').value = '';
    document.getElementById('catAddBrand').value = '';
    document.getElementById('catAddSpecValue').value = '';
    document.getElementById('catAddSpecUnit').value = '';
    if (document.getElementById('catAddPackageUnit')) document.getElementById('catAddPackageUnit').value = '个';
    document.getElementById('catAddProdDate').value = '';
    document.getElementById('catAddExpiryDate').value = '';
    document.getElementById('catAddQuantity').value = '1';
}

function switchCatTab(tab) {
    document.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cat-tab-content').forEach(c => c.style.display = 'none');
    
    document.getElementById(`cat-btn-${tab}`).classList.add('active');
    document.getElementById(`cat-tab-${tab}`).style.display = 'block';

    const fInv = document.getElementById('cat-float-inventory');
    const fLogs = document.getElementById('cat-float-logs');
    if (fInv && fLogs) {
        fInv.classList.remove('active'); fLogs.classList.remove('active');
        if (tab === 'inventory') fInv.classList.add('active'); else fLogs.classList.add('active');
    }
    const fInvItem = document.getElementById('cat-float-inventory-item');
    const fLogsItem = document.getElementById('cat-float-logs-item');
    if (fInvItem && fLogsItem) {
        // Toggle styles
        if (tab === 'inventory') {
            fInvItem.style.background = '#e6f7ff'; fInvItem.style.color = '#1890ff'; fInvItem.style.borderColor = '#91d5ff';
            fLogsItem.style.background = '#f5f5f5'; fLogsItem.style.color = '#666'; fLogsItem.style.borderColor = '#ddd';
        } else {
            fLogsItem.style.background = '#e6f7ff'; fLogsItem.style.color = '#1890ff'; fLogsItem.style.borderColor = '#91d5ff';
            fInvItem.style.background = '#f5f5f5'; fInvItem.style.color = '#666'; fInvItem.style.borderColor = '#ddd';
        }
    }

    if (tab === 'inventory') renderCatInventory();
    if (tab === 'logs') renderCatLogs();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initCatData();
    updateCatCategoryChips();
    const addCat = document.getElementById('catAddCategory');
    const addPkg = document.getElementById('catAddPackageUnit');
    if (addCat && addPkg) {
        addCat.addEventListener('change', applyAddCategoryDefaults);
        applyAddCategoryDefaults();
    }
});

function applyAddCategoryDefaults() {
    const catSel = document.getElementById('catAddCategory');
    const pkgSel = document.getElementById('catAddPackageUnit');
    if (!catSel || !pkgSel) return;
    const val = catSel.value;
    if (val === '罐头') {
        pkgSel.value = '罐';
        pkgSel.disabled = true;
    } else if (val === '猫砂') {
        pkgSel.value = '包';
        pkgSel.disabled = true;
    } else {
        pkgSel.disabled = false;
    }
}

function findCatItem(id) {
    return catInventory.find(i => i.id === id);
}

function copyCatItem(id) {
    const item = findCatItem(id);
    if (!item) return;
    const parts = [];
    if (item.brand) parts.push(`品牌: ${item.brand}`);
    parts.push(`名称: ${item.name}`);
    parts.push(`分类: ${item.category}`);
    if (item.specValue && item.specUnit) parts.push(`规格: ${item.specValue}${item.specUnit}`);
    parts.push(`数量: x${item.quantity}`);
    parts.push(`单价/总价: ¥${item.value}`);
    parts.push(`购入: ${item.purchaseDate}`);
    if (item.expiryDate) parts.push(`保质期至: ${item.expiryDate}`);
    const text = parts.join(' | ');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('已复制当前记录'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制当前记录');
    }
}

function editCatExpiry(id) {
    const item = findCatItem(id);
    if (!item) return;
    const val = prompt('请输入新的保质期至 (YYYY-MM-DD)', item.expiryDate || '');
    if (val === null) return;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (!ok) { showToast('格式应为 YYYY-MM-DD'); return; }
    item.expiryDate = val;
    saveCatData();
    renderCatInventory();
    showToast('保质期已更新');
}

function editCatQuantity(id) {
    const item = findCatItem(id);
    if (!item) return;
    const val = prompt('请输入新的数量 (>=1)', String(item.quantity));
    if (val === null) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) { showToast('请输入有效的整数数量'); return; }
    item.quantity = num;
    saveCatData();
    renderCatInventory();
    showToast('数量已更新');
}

function duplicateCatItem(id) {
    const item = findCatItem(id);
    if (!item) return;
    addCatItem({
        name: item.name,
        category: item.category,
        value: item.value,
        specValue: item.specValue,
        specUnit: item.specUnit,
        brand: item.brand,
        productionDate: item.productionDate,
        expiryDate: item.expiryDate,
        quantity: item.quantity
    });
    renderCatInventory();
    showToast('已复制一条入库记录');
}

let currentCatDetailId = null;

function openCatDetail(id) {
    const item = findCatItem(id);
    if (!item) return;
    currentCatDetailId = id;
    const t = document.getElementById('catDetailTitle');
    if (t) t.textContent = `${item.brand ? item.brand + ' · ' : ''}${item.name} · ${item.category}`;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('catDetailBrand', item.brand);
    setVal('catDetailName', item.name);
    setVal('catDetailCategory', item.category);
    setVal('catDetailSpecValue', item.specValue);
    setVal('catDetailSpecUnit', item.specUnit);
    setVal('catDetailPackageUnit', item.packageUnit);
    setVal('catDetailQty', item.quantity);
    setVal('catDetailValue', item.value);
    setVal('catDetailProdDate', item.productionDate);
    setVal('catDetailExpiry', item.expiryDate);
    showModal('catDetailModal');
    const mask = document.getElementById('mask');
    if (mask) { 
        mask.style.zIndex = '100000';
        mask.style.backdropFilter = 'blur(8px)';
        mask.style.webkitBackdropFilter = 'blur(8px)';
    }
    const modal = document.getElementById('catDetailModal');
    if (modal) { 
        modal.style.zIndex = '100001';
        modal.style.position = 'fixed';
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
    }
    const bar = document.getElementById('catFloatingBar');
    if (bar) bar.style.display = 'none';
    const dCat = document.getElementById('catDetailCategory');
    const dPkg = document.getElementById('catDetailPackageUnit');
    if (dCat && dPkg) {
        dCat.addEventListener('change', applyDetailCategoryDefaults);
        applyDetailCategoryDefaults();
    }
    attachDatePickerHelpers();
}

function saveCatDetail() {
    if (!currentCatDetailId) { closeAllModals(); return; }
    const item = findCatItem(currentCatDetailId);
    if (!item) { closeAllModals(); return; }
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const q = parseInt(getVal('catDetailQty') || '1', 10);
    if (isNaN(q) || q < 1) { showToast('请输入有效数量'); return; }
    item.brand = getVal('catDetailBrand').trim();
    item.name = getVal('catDetailName').trim();
    item.category = getVal('catDetailCategory');
    item.specValue = getVal('catDetailSpecValue');
    item.specUnit = getVal('catDetailSpecUnit');
    item.packageUnit = getVal('catDetailPackageUnit');
    item.quantity = q;
    item.value = parseFloat(getVal('catDetailValue') || '0') || 0;
    item.productionDate = getVal('catDetailProdDate');
    item.expiryDate = getVal('catDetailExpiry');
    saveCatData();
    closeAllModals();
    renderCatInventory();
    showToast('已更新库存详情');
}

function closeCatDetailModal() {
    closeAllModals();
    if (typeof setCatBarVisible === 'function') setCatBarVisible(true);
}

function attachDatePickerHelpers() {
    const enhance = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const openPicker = () => {
            try {
                if (typeof el.showPicker === 'function') {
                    el.showPicker();
                } else {
                    el.click();
                }
            } catch(e) {
                el.click();
            }
        };
        const wrap = el.parentElement;
        if (wrap) {
            wrap.style.position = 'relative';
            wrap.style.cursor = 'pointer';
            wrap.onclick = () => {
                el.focus();
                openPicker();
            };
            // Ensure icon never blocks click
            const svg = wrap.querySelector('svg');
            if (svg) svg.style.pointerEvents = 'none';
        }
        // Make clicking the input itself always open picker
        el.addEventListener('click', openPicker);
        el.addEventListener('focus', () => setTimeout(openPicker, 10));
        el.addEventListener('touchstart', () => { el.focus(); setTimeout(openPicker, 10); }, {passive: true});
    };
    ['catAddProdDate','catAddExpiryDate','catDetailProdDate','catDetailExpiry'].forEach(enhance);
}
function applyDetailCategoryDefaults() {
    const catSel = document.getElementById('catDetailCategory');
    const pkgSel = document.getElementById('catDetailPackageUnit');
    if (!catSel || !pkgSel) return;
    const val = catSel.value;
    if (val === '罐头') {
        pkgSel.value = '罐';
        pkgSel.disabled = true;
    } else if (val === '猫砂') {
        pkgSel.value = '包';
        pkgSel.disabled = true;
    } else {
        pkgSel.disabled = false;
    }
}

function confirmDeleteCatItem(id) {
    const item = findCatItem(id);
    if (!item || typeof customConfirm !== 'function') return;
    const title = '删除库存';
    const msg = `确认删除“${item.brand ? item.brand + ' - ' : ''}${item.name}”的库存与入库记录？`;
    customConfirm(title, msg, '删除', '取消', () => { deleteCatItem(id); });
}

function deleteCatItem(id) {
    const idx = catInventory.findIndex(i => i.id === id);
    if (idx === -1) return;
    const name = catInventory[idx].name;
    catInventory.splice(idx, 1);
    catLogs = catLogs.filter(l => !(l.type === 'inbound' && l.itemName === name));
    saveCatData();
    renderCatInventory();
    showToast('删除成功');
}

let catConfirmCallback = null;
function customConfirm(title, msg, okText, cancelText, onOk) {
    const t = document.getElementById('catConfirmTitle');
    const m = document.getElementById('catConfirmMsg');
    const ok = document.getElementById('catConfirmOk');
    const cancel = document.getElementById('catConfirmCancel');
    if (t) t.textContent = title || '确认操作';
    if (m) m.textContent = msg || '';
    if (ok) ok.textContent = okText || '确认';
    if (cancel) cancel.textContent = cancelText || '取消';
    catConfirmCallback = onOk || null;
    showModal('catConfirmModal');
    // Ensure the mask and modal are above sticky bars
    const mask = document.getElementById('mask');
    if (mask) { mask.style.zIndex = '100000'; mask.style.backdropFilter = 'blur(8px)'; mask.style.webkitBackdropFilter = 'blur(8px)'; }
    const modal = document.getElementById('catConfirmModal');
    if (modal) { modal.style.zIndex = '100001'; modal.style.position = 'fixed'; modal.style.left = '50%'; modal.style.top = '50%'; modal.style.transform = 'translate(-50%, -50%)'; }
}
function runCatConfirmOk() {
    const cb = catConfirmCallback;
    catConfirmCallback = null;
    closeAllModals();
    if (typeof cb === 'function') cb();
}
function toggleCatCategoryPanel() {
    const panel = document.getElementById('catCategoryPanel');
    if (!panel) return;
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
}

function toggleCatCategory(cat) {
    if (cat === 'all') {
        selectedCatCategories.clear();
    } else {
        if (selectedCatCategories.has(cat)) selectedCatCategories.delete(cat);
        else selectedCatCategories.add(cat);
    }
    updateCatCategoryChips();
    renderCatInventory();
}

function updateCatCategoryChips() {
    const chips = document.querySelectorAll('#catCategoryPanel .cat-chip');
    chips.forEach(chip => {
        const cat = chip.getAttribute('data-cat');
        const active = (selectedCatCategories.size === 0 && cat === 'all') || (cat !== 'all' && selectedCatCategories.has(cat));
        chip.style.background = active ? '#e6f7ff' : 'white';
        chip.style.borderColor = active ? '#91d5ff' : '#ddd';
        chip.style.color = active ? '#1890ff' : '#666';
    });
}
