// public/script.js - Phiên bản có thêm tính năng Auto-Refresh

function formatTimeAgo(timestamp) { /* ... Giữ nguyên từ phiên bản trước ... */ }

document.addEventListener('DOMContentLoaded', () => {
    // ... (Các hằng số giữ nguyên) ...
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    // === BIẾN MỚI: Để theo dõi bộ đếm thời gian ===
    let refreshIntervalId = null;

    const showLoading = (isLoading, isBackground = false) => {
        // Chỉ hiển thị spinner lớn nếu không phải là làm mới trong nền
        if (isLoading && !isBackground) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else if (!isLoading) {
            loading.style.display = 'none';
        }
    };

    const loadNetworks = async () => { /* ... Giữ nguyên từ phiên bản trước ... */ };

    // === HÀM loadMembers ĐƯỢC NÂNG CẤP ===
    const loadMembers = async (networkId, isBackground = false) => {
        // Tham số isBackground để phân biệt lần tải đầu và các lần tự động làm mới
        showLoading(true, isBackground);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) { memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào.</li>'; return; }
            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                // ... (Toàn bộ phần tạo `li.innerHTML` giữ nguyên như phiên bản 1.2)
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.nodeId}`;
                // ... (code tạo HTML)
                 li.innerHTML = `...`; // Giữ nguyên phần HTML phức tạp của bạn ở đây
            });
        } catch (error) { 
            console.error('Error loading members:', error);
            // Chỉ báo lỗi nếu không phải là làm mới trong nền
            if (!isBackground) {
                alert('Failed to load members.');
            }
        }
        showLoading(false, isBackground);
    };

    const updateMember = async (networkId, memberId, payload) => { /* ... Giữ nguyên từ phiên bản trước ... */ };
    
    const toggleEditState = (listItem, field, isEditing) => { /* ... Giữ nguyên từ phiên bản trước ... */ };

    // === EVENT LISTENER CỦA NETWORK SELECT ĐƯỢC NÂNG CẤP ===
    networkSelect.addEventListener('change', () => {
        const networkId = networkSelect.value;
        if (!networkId || networkId === 'Chọn một network...') return;

        // Xóa bộ đếm thời gian cũ (nếu có) trước khi bắt đầu cái mới
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }

        // Tải danh sách thành viên ngay lập tức
        loadMembers(networkId);

        // Bắt đầu một bộ đếm thời gian mới để tự động làm mới sau mỗi 60 giây
        const refreshIntervalMinutes = 1;
        const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;
        
        refreshIntervalId = setInterval(() => {
            console.log(`Auto-refreshing members for network ${networkId}...`);
            // Gọi hàm với isBackground = true để không hiển thị spinner lớn
            loadMembers(networkId, true);
        }, refreshIntervalMs);
    });
    
    memberList.addEventListener('click', (event) => { /* ... Giữ nguyên từ phiên bản trước ... */ });
    
    loadNetworks();
});
