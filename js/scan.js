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

        // --- Modified: Add Error Handling for Storage Full ---
        try {
            localStorage.setItem('bead_plans', JSON.stringify(plans));
        } catch (e) {
            console.error("Save plan failed:", e);
            // Check for QuotaExceededError
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                // Strategy: Retry without thumbnail
                if (newPlan.thumbnail) {
                    console.warn("Storage full, retrying without thumbnail...");
                    newPlan.thumbnail = null; // Remove thumbnail to free up space
                    try {
                        localStorage.setItem('bead_plans', JSON.stringify(plans));
                        alert('由于存储空间不足，计划已创建但无法保存缩略图。\n建议清理旧的已完成计划以释放空间。');
                    } catch (retryErr) {
                         console.error("Retry failed:", retryErr);
                         alert('存储空间严重不足，无法保存新计划！\n请删除一些旧计划后重试。');
                         return; // Abort
                    }
                } else {
                    alert('存储空间不足，无法保存新计划！\n请删除一些旧计划后重试。');
                    return; // Abort
                }
            } else {
                alert('保存计划时发生未知错误: ' + e.message);
                return; // Abort
            }
        }
        // --- End Modification ---

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
                 // Optimized: Reduced maxDim from 3072 to 1024 to save space
                 const maxDim = 1024; 
                 let w = originalImg.naturalWidth;
                 let h = originalImg.naturalHeight;
                 if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } } 
                 else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
                 canvas.width = w; canvas.height = h;
                 ctx.drawImage(originalImg, 0, 0, w, h);
                 // Optimized: Reduced quality from 0.92 to 0.8
                 thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            } else if (typeof cropper !== 'undefined' && cropper) {
                // Optimized: Reduced max dimensions
                thumbnail = cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toDataURL('image/jpeg', 0.8);
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
        
        // --- Modified: Add Error Handling for Storage Full ---
        try {
            localStorage.setItem('bead_plans', JSON.stringify(plans));
        } catch (e) {
            // Strategy: Retry without thumbnail
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (newPlan.thumbnail) {
                    newPlan.thumbnail = null;
                    try {
                        localStorage.setItem('bead_plans', JSON.stringify(plans));
                        alert('存储空间预警：计划已创建（无缩略图）。');
                    } catch (retryErr) {
                         alert('存储空间已满，无法创建计划！请清理数据。');
                         return; // Critical: Stop deduction if plan cannot be saved
                    }
                } else {
                    alert('存储空间已满，无法创建计划！请清理数据。');
                    return;
                }
            } else {
                alert('保存失败: ' + e.message);
                return;
            }
        }
        // --- End Modification ---

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
        
        try {
            localStorage.setItem('bead_plans', JSON.stringify(plans)); // Save updated status
        } catch(e) {
            console.warn("Failed to update plan status to completed in storage", e);
            // Non-critical: Plan is created and inventory is deducted. 
            // The plan will just show as 'active' instead of 'completed' if reload happens before next save.
        }
        
        showToast(`已自动创建计划并扣减 ${count} 个色号库存。`);
        resetScan(); // Auto clear scan page
        navToDock('plan');
        setPlanFilter('completed');
    }
