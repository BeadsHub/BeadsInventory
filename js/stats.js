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
        
        // New Stats
        const zeroCount = statsData.filter(item => (item.w || 0) <= 0).length;
        const pendingBags = statsData.reduce((sum, item) => sum + (item.pendingBags || 0), 0);
        
        // Plan Rate Calculation
        let planRate = 0;
        try {
            const plans = JSON.parse(localStorage.getItem('bead_plans') || '[]');
            let totalP = 0;
            let completedP = 0;
            const traverse = (list) => {
                list.forEach(p => {
                    if (p.subPlans && p.subPlans.length > 0) {
                        traverse(p.subPlans);
                    } else {
                        totalP++;
                        if (p.status === 'completed') completedP++;
                    }
                });
            };
            traverse(plans);
            if (totalP > 0) planRate = Math.round((completedP / totalP) * 100);
        } catch(e) {}

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

        // New Stats Update
        const elZeroCount = document.getElementById('stats-zero-count');
        if(elZeroCount) elZeroCount.textContent = zeroCount;
        
        const elPendingBags = document.getElementById('stats-pending-bags');
        if(elPendingBags) elPendingBags.textContent = pendingBags;
        
        const elPlanRate = document.getElementById('stats-plan-rate');
        if(elPlanRate) elPlanRate.textContent = planRate + '%';

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