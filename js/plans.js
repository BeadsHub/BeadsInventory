    let currentPlanId = null;
    let isPlanSelectionMode = false;
    let selectedPlanIds = new Set();
    let expandedPlanIds = new Set();
    let expandedPlanColorIds = new Set();
    let longPressTimer = null;
    let currentPlanFilter = 'active';
    let selectedPlanTagsFilter = new Set();

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
                const nameEl = document.getElementById('planDetailName');
                if (nameEl) nameEl.innerText = plan.name;
                
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
            // Ignore if tagged as '待定'
            if (plan.tags && plan.tags.includes('待定')) {
                return;
            }

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
        
        // Tag filter (OR across selected tags, match in plan or any sub-plan)
        const hasAnyTag = (plan, tagsSet) => {
            if (!tagsSet || tagsSet.size === 0) return true;
            const tagsArr = plan.tags || [];
            if (tagsArr.some(t => tagsSet.has(t))) return true;
            if (plan.subPlans && plan.subPlans.length > 0) {
                return plan.subPlans.some(sp => hasAnyTag(sp, tagsSet));
            }
            return false;
        };
        if (selectedPlanTagsFilter.size > 0) {
            filtered = filtered.filter(p => hasAnyTag(p, selectedPlanTagsFilter));
        }

        let isSearchMode = false;
        if (query) {
            isSearchMode = true;
            filtered = filterPlansByQuery(filtered, query);
        }

        // Render Tag Filter Bar below search
        const tagBar = document.getElementById('planTagFilterBar');
        if (tagBar) {
            const tagFreq = new Map();
            const collectTags = (p) => {
                if (p.tags && Array.isArray(p.tags)) {
                    p.tags.forEach(t => {
                        const k = String(t).trim();
                        if (!k) return;
                        tagFreq.set(k, (tagFreq.get(k) || 0) + 1);
                    });
                }
                if (p.subPlans && p.subPlans.length > 0) p.subPlans.forEach(collectTags);
            };
            plans.forEach(collectTags);
            const tags = Array.from(tagFreq.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
            tagBar.innerHTML = tags.map(([t,c]) => {
                const active = selectedPlanTagsFilter.has(t);
                const bg = active ? '#e6f7ff' : '#f0f5ff';
                const color = active ? '#1890ff' : '#4a90e2';
                const border = active ? '#91d5ff' : '#d6e4ff';
                return `<button onclick="togglePlanTagFilter('${t.replace(/'/g, "\\'")}')" style="padding:4px 10px; border-radius:12px; border:1px solid ${border}; background:${bg}; color:${color}; font-size:12px; cursor:pointer; white-space: nowrap;">${t}</button>`;
            }).join('');
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
                     const missingItems = summary.shortages.map(item => {
                        const bead = data.find(d => d.id === item.code);
                        const bags = Math.ceil(item.missingQty / 10);
                        // Consistent with shopping list: consider pending only if we bought enough or more
                        const isPending = bead && bead.pendingBags > 0 && bead.pendingBags >= bags;
                        
                        const bg = isPending ? '#f6ffed' : 'rgba(255,255,255,0.8)';
                        const border = isPending ? '#b7eb8f' : '#ffccc7';
                        const textColor = isPending ? '#333' : '#cf1322';
                        const infoText = isPending ? '<span style="color:#52c41a">已购</span>' : `缺 ${item.missingQty}g`;

                        return `
                        <div onclick="searchPlanByColor('${item.code}')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; background: ${bg}; padding: 4px 8px; border-radius: 6px; border: 1px solid ${border}; margin-bottom: 4px; transition: transform 0.1s, background 0.1s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
                            <span style="font-weight: bold; color: ${textColor};">${item.code} ${isPending ? '<span style="font-size:10px; color:#52c41a; font-weight:normal; margin-left:2px;">(在途)</span>' : ''}</span>
                            <span style="font-size: 12px; color: #666;">${infoText}</span>
                        </div>
                    `}).join('');
                     
                     missingHtml = `
                         <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #ffa39e;">
                             <div style="font-size: 13px; font-weight: bold; color: #cf1322; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                               <div style="display:flex; align-items:center;">
                                   <span style="margin-right: 4px;">⚠️</span> 缺货预警 (${summary.shortages.length} 色)
                               </div>
                               <button id="generateShoppingListBtn" style="background: white; border: 1px solid #ffadd2; color: #eb2f96; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                   <span>🛒</span> 补货单
                               </button>
                           </div>
                             <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px;">
                                 ${missingItems}
                             </div>
                             <div style="font-size:10px; color:#999; margin-top:8px; text-align:right;">
                                * 已自动忽略标签为“待定”的计划
                             </div>
                         </div>
                     `;
                 } else {
                     missingHtml = `
                         <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #bae7ff; color: #52c41a; font-size: 13px; font-weight: bold;">
                             ✅ 库存充足，无缺货色号
                         </div>
                         <div style="font-size:10px; color:#999; margin-top:4px; text-align:right;">
                            * 已自动忽略标签为“待定”的计划
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
                 
                 // Bind click event listener after adding to DOM to avoid quote escaping issues
                 const btn = document.getElementById('generateShoppingListBtn');
                 if (btn) {
                     btn.onclick = () => generateShoppingList(summary.shortages);
                 }
             }
        }
        renderPlanList(filtered, container, isSearchMode);
    }

    function togglePlanTagFilter(tag) {
        if (selectedPlanTagsFilter.has(tag)) {
            selectedPlanTagsFilter.delete(tag);
        } else {
            selectedPlanTagsFilter.add(tag);
        }
        renderPlans();
    }

    function filterPlansByQuery(list, query) {
        let result = [];
        list.forEach(p => {
            // Match Name
            const matchName = p.name && p.name.toLowerCase().includes(query);
            
            // Match Tags
            let matchTags = false;
            if (p.tags && p.tags.length > 0) {
                matchTags = p.tags.some(tag => tag.toLowerCase().includes(query));
            }
            
            // Match Color Code (in items)
            let matchColor = false;
            if (p.items && p.items.length > 0) {
                matchColor = p.items.some(item => item.code && item.code.toLowerCase().includes(query));
            }

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
            } else if (matchName || matchColor || matchTags) {
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
        
        // 3. Delete (Only if NOT completed)
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
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                actions[index].click(e);
            }, { passive: false });
            btn.addEventListener('pointerup', (e) => {
                actions[index].click(e);
            });
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

        let tagsHtml = '';
        if (plan.tags && plan.tags.length > 0) {
            tagsHtml = `
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
                    ${plan.tags.map(tag => `<span style="font-size:10px; background:#f0f5ff; color:#4a90e2; padding:1px 6px; border-radius:8px; border:1px solid #d6e4ff;">${tag}</span>`).join('')}
                </div>
            `;
        }

        innerEl.innerHTML = `
            <div style="display: flex; align-items: stretch; width: 100%;">
                ${folderExpandHtml}
                ${checkboxHtml}
                
                <div style="flex: 1; overflow: hidden; padding-right: 8px;">
                    <div style="display: flex; align-items: center; margin-bottom: 4px;">
                        ${iconContainerHtml}
                        <div style="font-weight: bold; font-size: 16px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${plan.name}
                        </div>
                    </div>
                    ${tagsHtml}

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
        const sortText = document.getElementById('planDetailSortText');
        if (sortText) {
            sortText.innerText = currentPlanDetailSort === 'qty' ? '按用量' : '按色号';
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
                
                // Update Cost
                const totalWeight = totalQty / 100;
                const totalCost = totalWeight * 0.1;
                const costEl = document.getElementById('planDetailCost');
                if (costEl) {
                    costEl.innerText = '¥' + totalCost.toFixed(2);
                }
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

        const nameEl = document.getElementById('planDetailName');
        if (nameEl) nameEl.innerText = plan.name;

        // Render Tags (Hook)
        if (typeof updatePlanDetailTagsUI === 'function') {
            updatePlanDetailTagsUI(plan);
        }
        
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
        const statusBanner = document.getElementById('planDetailStatusContainer');
        const actionButtons = document.getElementById('planActiveActions');
        
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
            statusBanner.style.padding = '12px 16px';
            statusBanner.style.borderRadius = '12px';

            // Container for layout
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;';

            // 1. Completed Time (Left)
            const timeDiv = document.createElement('div');
            // Use flex-start to align left
            timeDiv.style.cssText = 'display: flex; flex-direction: column; justify-content: center; align-items: flex-start;';
            
            if (plan.completedAt) {
                const dateObj = new Date(plan.completedAt);
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                const h = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                // Removed seconds for cleaner display
                const timeStr = `${y}/${m}/${d} ${h}:${min}`;
                
                timeDiv.innerHTML = `
                    <div style="font-size: 11px; opacity: 0.8; line-height: 1.2;">完成于</div>
                    <div style="font-size: 15px; font-weight: 600; line-height: 1.3; font-family: monospace, sans-serif; white-space: nowrap;">${timeStr}</div>
                `;
            } else {
                timeDiv.innerHTML = `<div style="font-size: 15px; font-weight: bold;">已完成</div>`;
            }
            row.appendChild(timeDiv);
            
            // 2. Edit Time Button (Right)
            const editBtn = document.createElement('button');
            // High z-index to ensure it's on top. Added white-space: nowrap to prevent text breaking
            editBtn.style.cssText = "display:flex; align-items:center; gap:5px; padding:8px 12px; border:none; border-radius:8px; width:fit-content; cursor:pointer; user-select:none; position: relative; z-index: 2; pointer-events: auto; font-family: inherit; margin: 0; white-space: nowrap; flex-shrink: 0;";
            
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

            row.appendChild(editBtn);
            statusBanner.appendChild(row);

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
        const totalWeight = totalQty / 100; // 100 beads approx 1g
        const totalCost = totalWeight * unitCost;
        
        const costEl = document.getElementById('planDetailCost');
        if (costEl) {
            costEl.innerText = '¥' + totalCost.toFixed(2);
        }

        // Render List using the current sort mode
        currentPlanDetailSort = 'qty'; 
        renderPlanDetailList();

        document.getElementById('page-plan').style.display = 'none';
        document.getElementById('page-plan-detail').style.display = 'block';
        if (typeof setCatBarVisible === 'function') setCatBarVisible(false);
        window.scrollTo(0, 0);
    }

    function closePlanDetail() {
        document.getElementById('page-plan-detail').style.display = 'none';
        document.getElementById('page-plan').style.display = 'block';
        if (typeof setCatBarVisible === 'function') setCatBarVisible(false);
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
    function searchPlanByColor(code) {
        const searchInput = document.getElementById('planSearch');
        if (searchInput) {
            searchInput.value = code;
            renderPlans();
            
            // Wait for render to complete, then scroll
            setTimeout(() => {
                const list = document.getElementById('planList');
                if(list) list.scrollIntoView({behavior: 'smooth', block: 'start'});
                showToast('\u5df2\u7b5b\u9009\u4f7f\u7528\u8272\u53f7 ' + code + ' \u7684\u8ba1\u5212');
            }, 100);
        }
    }

    function togglePlanTagsVisibility() {
        const bar = document.getElementById('planTagFilterBar');
        const btn = document.getElementById('toggleTagsBtn');
        if (!bar || !btn) return;
        
        const isHidden = bar.style.display === 'none';
        if (isHidden) {
            bar.style.display = 'flex';
            btn.style.background = '#e6f7ff';
            btn.style.color = '#1890ff';
            btn.style.borderColor = '#91d5ff';
        } else {
            bar.style.display = 'none';
            btn.style.background = 'white';
            btn.style.color = '#666';
            btn.style.borderColor = '#ddd';
        }
    }
