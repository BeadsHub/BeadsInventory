
// ==================== Color Matcher Logic ====================

function openFindColorModal() {
    document.getElementById('findColorModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    performColorSearch(); // Search immediately with default color
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
}

// Redmean Color Distance
function colorDistance(c1, c2) {
    const rmean = (c1.r + c2.r) / 2;
    const r = c1.r - c2.r;
    const g = c1.g - c2.g;
    const b = c1.b - c2.b;
    return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
}

function performColorSearch() {
    const input = document.getElementById('findColorInput');
    const hexDisplay = document.getElementById('findColorHex');
    const list = document.getElementById('findColorList');
    
    if (!input || !hexDisplay || !list) return;

    const targetHex = input.value;
    hexDisplay.textContent = targetHex.toUpperCase();
    
    const targetRgb = hexToRgb(targetHex);

    // Filter valid data (must have hex code)
    const candidates = data.filter(item => item.hex);

    // Calculate distances
    const results = candidates.map(item => {
        const itemRgb = hexToRgb(item.hex);
        return {
            item: item,
            dist: colorDistance(targetRgb, itemRgb)
        };
    });

    // Sort by distance (asc)
    results.sort((a, b) => a.dist - b.dist);

    // Top 10
    const top10 = results.slice(0, 10);

    // Render
    list.innerHTML = top10.map(r => {
        const item = r.item;
        const stock = item.w || 0;
        const isLow = stock < (threshold || 200);
        const percent = Math.max(0, 100 - (r.dist / 5)); // Rough similarity percentage

        return `
            <div style="display:flex; align-items:center; padding:12px; background:white; margin-bottom:10px; border-radius:12px; border:1px solid #eee;">
                <div style="width:40px; height:40px; border-radius:50%; background:${item.hex}; border:2px solid #ddd; margin-right:15px; flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:16px; color:#333;">${item.id}</div>
                    <div style="font-size:12px; color:#999;">${item.n || '未命名'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; color:${isLow ? '#ff4d4f' : '#52c41a'}; font-weight:bold;">
                        ${stock}粒
                    </div>
                    <div style="font-size:10px; color:#aaa; margin-top:2px;">
                        相似度 ${(percent).toFixed(0)}%
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
