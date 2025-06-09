// === HÀM HỖ TRỢ ĐỊNH DẠNG THỜI GIAN ===
function formatTimeAgo(timestamp) {
    if (!timestamp || timestamp === 0) {
        return 'Chưa bao giờ';
    }
    const now = new Date();
    const seenTime = new Date(timestamp);
    const seconds = Math.floor((now - seenTime) / 1000);
    if (seconds < 60) return "Vài giây trước";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    return seenTime.toLocaleDateString('vi-VN');
}

document.addEventListener('DOMContentLoaded', () => {
    // ... (Các hằng số giữ nguyên)
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading) => {
        loading.style.display = isLoading ? 'block' : 'none';
        if (isLoading) {
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        }
    };

    const loadNetworks = async () => {
        // ... (Hàm này giữ nguyên, không cần sửa)
        showLoading(true);
        networkSelect.disabled = true;
        try {
            const response = await fetch('/.netlify/functions/get-networks');
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            const networks = await response.json();
            networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>';
            networks.forEach(net => {
                const option = document.createElement('option');
                option.value = net.id;
                option.textContent = `${net.config.name || 'Unnamed Network'} (${net.id})`;
                networkSelect.appendChild(option);
            });
            networkSelect.disabled = false;
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks. Vui lòng kiểm tra lại Console (F12) để xem chi tiết lỗi.');
        }
        showLoading(false);
    };

    // === HÀM loadMembers ĐÃ ĐƯỢC CẬP NHẬT ===
    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';

            if (members.length === 0) {
                memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào trong network này.</li>';
                return;
            }

            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap';

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                const authorizedStatus = member.config.authorized;
                const lastSeen = member.lastSeen;
                const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                
                // Lấy thông tin vị trí từ dữ liệu backend đã gộp
                const location = member.location;
                let locationString = 'Không rõ vị trí';
                if (location && location.city) {
                    // Tạo chuỗi hiển thị vị trí: "Hanoi, VN"
                    locationString = `${location.city}, ${location.country}`;
                }

                li.innerHTML = `
                    <div class="me-3 mb-2">
                        <strong>${name}</strong>
                        <br>
                        <small class="text-muted">${member.nodeId}</small>
                        <br>
                        <small>IP ảo: ${ip}</small>
                        <br>
                        <small class="text-info">Physical IP: ${physicalAddress}</small>
                        <br>
                        <small class="text-primary">📍 Vị trí: ${locationString}</small>
                        <br>
                        <small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small>
                    </div>
                    <div class="d-flex align-items-center">
                         <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                        <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" 
                                data-member-id="${member.nodeId}" 
                                data-authorize="${!authorizedStatus}">
                            ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                        </button>
                    </div>
                `;
                memberList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading members:', error);
            alert('Failed to load members.');
        }
        showLoading(false);
    };

    // ... (Các hàm và event listener còn lại giữ nguyên)
    const toggleAuthorization = async (networkId, memberId, shouldAuthorize) => {
        const button = document.querySelector(`button[data-member-id='${memberId}']`);
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        try {
            const response = await fetch('/.netlify/functions/authorize-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    networkId: networkId,
                    memberId: memberId,
                    authorize: shouldAuthorize,
                }),
            });
            if (!response.ok) throw new Error('Failed to update member status.');
            await loadMembers(networkId);
        } catch (error) {
            console.error('Error updating member:', error);
            alert('Failed to update member.');
            button.disabled = false;
        }
    };
    networkSelect.addEventListener('change', () => {
        const networkId = networkSelect.value;
        if (networkId && networkId !== 'Chọn một network...') {
            loadMembers(networkId);
        }
    });
    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button) {
            const memberId = button.dataset.memberId;
            const shouldAuthorize = button.dataset.authorize === 'true';
            const networkId = networkSelect.value;
            toggleAuthorization(networkId, memberId, shouldAuthorize);
        }
    });
    loadNetworks();
});
