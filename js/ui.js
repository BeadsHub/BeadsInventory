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




