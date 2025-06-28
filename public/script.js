// public/script.js - Nâng cấp Bước 2: Tối ưu UI

function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading) => { /* ... Giữ nguyên ... */ };
    const updateMember = async (networkId, memberId, payload) => { /* ... Giữ nguyên ... */ };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`${WORKER_URL}/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) {
                memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào.</li>';
                return;
            }

            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.nodeId}`;

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                const authorizedStatus = member.config.authorized;
                const lastSeen = member.lastSeen;
                const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                const location = member.location;
                let locationString = 'Không rõ vị trí';
                if (location && location.city) locationString = `${location.city}, ${location.country}`;
                const asnString = location && location.org ? location.org : 'Không rõ';

                // Thêm một thẻ div bao bọc để dễ dàng dùng Flexbox
                li.innerHTML = `
                    <div class="item-wrapper">
                        <div class="info-block">
                            <strong>${name}</strong>
                            <br>
                            <small class="text-muted">${member.nodeId}</small>
                            <div class="mt-2">
                                <small>IP ảo: ${ip}</small><br>
                                <small class="text-info">Physical IP: ${physicalAddress}</small><br>
                                <small class="text-primary">📍 Vị trí: ${locationString}</small><br>
                                <small class="text-secondary">🏢 ASN: ${asnString}</small><br>
                                <small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small>
                            </div>
                        </div>
                        <div class="action-block d-flex align-items-center">
                            <span class="me-3 ${authorizedStatus ? 'text-success' : 'text-danger'}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                            <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">
                                ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                            </button>
                        </div>
                    </div>`;
                memberList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading members:', error);
            alert('Failed to load members.');
        }
        showLoading(false);
    };

    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        try {
            const response = await fetch(`${WORKER_URL}/get-networks`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const networks = await response.json();
            networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>';
            networks.forEach(net => {
                const option = document.createElement('option');
                option.value = net.id;
                option.textContent = `${net.config.name || 'Unnamed Network'} (${net.id})`;
                networkSelect.appendChild(option);
            });
            networkSelect.disabled = false;

            // === THÊM LOGIC TỰ ĐỘNG CHỌN ===
            if (networks.length === 1) {
                networkSelect.selectedIndex = 1; // Chọn network đầu tiên (index 0 là "Chọn...")
                networkSelect.dispatchEvent(new Event('change')); // Kích hoạt sự kiện change để tải members
            }
            
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks.');
        }
        showLoading(false);
    };

    networkSelect.addEventListener('change', () => { /* ... Giữ nguyên ... */ });
    memberList.addEventListener('click', (event) => { /* ... Giữ nguyên ... */ });
    
    loadNetworks();
});
