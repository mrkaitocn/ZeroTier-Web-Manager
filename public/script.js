// public/script.js - Phiên bản cập nhật đường dẫn API cho Cloudflare

function formatTimeAgo(timestamp) { /* ... Giữ nguyên ... */ }

document.addEventListener('DOMContentLoaded', () => {
    // ... (Các hằng số và biến giữ nguyên) ...
    let refreshIntervalId = null;
    let currentNetworkId = null;
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    const showLoading = (isLoading, isBackground = false) => { /* ... Giữ nguyên ... */ };

    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        try {
            // === THAY ĐỔI ĐƯỜNG DẪN API ===
            const response = await fetch('/get-networks');
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const networks = await response.json();
            
            // ... (phần xử lý networks còn lại giữ nguyên) ...

        } catch (error) { console.error('Error loading networks:', error); alert('Failed to load networks.'); }
        showLoading(false);
    };

    const loadMembers = async (networkId, isBackground = false) => {
        showLoading(true, isBackground);
        try {
            // === THAY ĐỔI ĐƯỜNG DẪN API ===
            const response = await fetch(`/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            // ... (phần xử lý và hiển thị members giữ nguyên) ...

        } catch (error) { if (!isBackground) { console.error('Error loading members:', error); alert('Failed to load members.'); } }
        showLoading(false, isBackground);
    };

    const updateMember = async (networkId, memberId, payload) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        memberElement.style.opacity = '0.5';
        try {
            // === THAY ĐỔI ĐƯỜNG DẪN API ===
            const response = await fetch('/authorize-member', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ networkId, memberId, ...payload }) 
            });
            if (!response.ok) { const errorText = await response.text(); throw new Error(errorText || 'Cập nhật thất bại'); }
            await loadMembers(networkId);
        } catch (error) {
            console.error('Error updating member:', error);
            alert(`Lỗi: ${error.message}`);
            if(memberElement) memberElement.style.opacity = '1';
        }
    };
    
    // ... (Các hàm và event listener còn lại giữ nguyên toàn bộ) ...
});
