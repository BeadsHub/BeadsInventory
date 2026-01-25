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
    
    // Ensure it is on top of other modals (must set after showModal which resets z-index)
    document.getElementById('customConfirmModal').style.zIndex = '1100';
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

    function save() { 
        try {
            localStorage.setItem('bead_v_sort', JSON.stringify(data)); 
        } catch (e) {
            console.error("Critical: Failed to save inventory data", e);
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                alert("严重警告：存储空间已满，库存变动无法保存！\n请立即删除一些旧的计划或清理空间。");
            }
        }
    }

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
