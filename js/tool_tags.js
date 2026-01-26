
// ==================== Tag Management Logic ====================

function openTagManageModal() {
    if (!currentPlanId) return;
    const plan = findPlanById(currentPlanId);
    if (!plan) return;

    // Render Current Tags
    renderCurrentTags(plan);
    renderHistoryTags(plan);

    // Clear input
    const input = document.getElementById('newTagInput');
    if(input) input.value = '';

    showModal('tagManageModal');
    
    // Focus input
    setTimeout(() => {
        if(input) input.focus();
    }, 100);
}

function renderCurrentTags(plan) {
    const container = document.getElementById('currentTagsList');
    if (!container) return;

    if (!plan.tags || plan.tags.length === 0) {
        container.innerHTML = '<span style="font-size:12px; color:#ccc; padding:4px;">暂无标签</span>';
        return;
    }

    container.innerHTML = plan.tags.map(tag => `
        <div class="plan-tag">
            ${tag}
            <span class="plan-tag-remove" onclick="removeTag('${tag}')">&times;</span>
        </div>
    `).join('');
}

function renderHistoryTags(plan) {
    const container = document.getElementById('tagHistoryList');
    if (!container) return;
    let plans = [];
    try {
        plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
    } catch(e) {
        plans = [];
    }
    const freq = new Map();
    const collect = (p) => {
        if (p.tags && Array.isArray(p.tags)) {
            p.tags.forEach(t => {
                const k = String(t).trim();
                if (!k) return;
                freq.set(k, (freq.get(k) || 0) + 1);
            });
        }
        if (p.subPlans && p.subPlans.length > 0) p.subPlans.forEach(collect);
    };
    plans.forEach(collect);
    // Exclude current plan's existing tags
    const existing = new Set((plan.tags || []).map(t => String(t)));
    const list = Array.from(freq.entries())
        .filter(([t]) => !existing.has(t))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (list.length === 0) {
        container.innerHTML = '<span style="font-size:12px; color:#ccc;">暂无历史标签</span>';
        return;
    }
    container.innerHTML = list.slice(0, 30).map(([t, c]) => `
        <button onclick="addTag('${t.replace(/'/g, "\\'")}')" 
            style="padding:6px 10px; border-radius:12px; border:1px solid #d6e4ff; background:#f0f5ff; color:#4a90e2; font-size:12px; cursor:pointer;">
            ${t}
        </button>
    `).join('');
}

function addNewTag() {
    const input = document.getElementById('newTagInput');
    if (!input) return;
    const tag = input.value.trim();
    if (tag) {
        addTag(tag);
        input.value = '';
    }
}

function finishTagEditing() {
    addNewTag(); // Try adding what's in the input first
    closeAllModals();
}

function addTag(tag) {
    if (!currentPlanId) return;
    
    let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
    const plan = findPlanById(currentPlanId, plans);
    
    if (plan) {
        if (!plan.tags) plan.tags = [];
        
        // Prevent duplicates
        if (!plan.tags.includes(tag)) {
            plan.tags.push(tag);
            localStorage.setItem('bead_plans', JSON.stringify(plans));
            
            // Re-render modal
            renderCurrentTags(plan);
            renderHistoryTags(plan);
            
            // Update Plan Detail UI immediately
            updatePlanDetailTagsUI(plan);
            
            showToast(`已添加标签: ${tag}`);
        } else {
            showToast('标签已存在');
        }
    }
}

function removeTag(tag) {
    if (!currentPlanId) return;
    
    let plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
    const plan = findPlanById(currentPlanId, plans);
    
    if (plan && plan.tags) {
        const index = plan.tags.indexOf(tag);
        if (index > -1) {
            plan.tags.splice(index, 1);
            localStorage.setItem('bead_plans', JSON.stringify(plans));
            
            // Re-render modal
            renderCurrentTags(plan);
            renderHistoryTags(plan);
            
            // Update Plan Detail UI immediately
            updatePlanDetailTagsUI(plan);
        }
    }
}

function updatePlanDetailTagsUI(plan) {
    const container = document.getElementById('planDetailTags');
    if (!container) return;
    
    if (!plan.tags || plan.tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = plan.tags.map(tag => `
        <span style="font-size:11px; background:#f0f5ff; color:#4a90e2; padding:2px 8px; border-radius:10px; border:1px solid #d6e4ff;">${tag}</span>
    `).join('');
    
    // Also refresh the main list to show new tags on cards
    renderPlans();
}

// Hook into viewPlanDetail to render tags
// Note: We need to modify viewPlanDetail in plans.js to call updatePlanDetailTagsUI
