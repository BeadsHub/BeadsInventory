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
                    <div class="sol-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed #f0f0f0;">
                        <span style="display:flex; align-items:center; gap:5px;">
                            <div style="width:10px; height:10px; background:${specs[i].color}; border-radius:2px;"></div>
                            <span style="font-size: 14px; color: #333;">${specs[i].w}x${specs[i].h}cm</span>
                        </span>
                        <b style="font-size: 14px; color: #1f2937;">x${c}</b>
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
                    <div style="margin-bottom:6px; font-weight: 600;">剩余布料:</div>`;
                
                for (let [size, count] of Object.entries(wasteGroups)) {
                    wasteHtml += `<div style="display:flex; justify-content:space-between; align-items: center; padding: 2px 0;">
                        <span>${size}cm</span>
                        <span>x${count}</span>
                    </div>`;
                }
                wasteHtml += `</div>`;
            }
        }
        
        return `<div class="sol-info" style="margin-top:15px; width:100%; border-top:1px solid #eee; padding-top:10px;">
                    <div style="margin-bottom:10px; font-weight:bold; font-size:15px; color:#111;">数量统计</div>
                    <div style="background: #f9fafb; padding: 10px; border-radius: 8px;">
                        ${statsHtml}
                    </div>
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
        const pageCat = document.getElementById('page-cat');
        if (pageCat) pageCat.style.display = 'none';
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
