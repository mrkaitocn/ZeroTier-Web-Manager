// public/script.js - Phiên bản v1.2 + Tính năng Tự Động Làm Mới

function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    // --- BIẾN MỚI ---
    // Biến này để lưu ID của bộ đếm thời gian, giúp chúng ta có thể dừng nó lại
    let refreshIntervalId = null;

    // --- CÁC HẰNG SỐ ---
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    // --- CÁC HÀM ---

    // Hàm showLoading được nâng cấp để không hiển thị spinner lớn khi làm mới trong nền
    const showLoading = (isLoading, isBackground = false) => {
        if (isLoading && !isBackground) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else if (!isLoading) {
            loading.style.display = 'none';
        }
    };

    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        try {
            const response = await fetch('/.netlify/functions/get-networks');
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
            if (networks.length === 1) {
                networkSelect.selectedIndex = 1;
                networkSelect.dispatchEvent(new Event('change'));
            }
        } catch (error) { console.error('Error loading networks:', error); alert('Failed to load networks.'); }
        showLoading(false);
    };

    // Hàm loadMembers được nâng cấp để hỗ trợ làm mới trong nền
    const loadMembers = async (networkId, isBackground = false) => {
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
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.nodeId}`;
                const name = member.name || 'Chưa đặt tên';
                const escapedName = name.replace(/"/g, '&quot;');
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                const authorizedStatus = member.config.authorized;
                const lastSeen = member.lastSeen;
                const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                const location = member.location;
                let locationString = 'Không rõ vị trí';
                if (location && location.city) locationString = `${location.city}, ${location.country}`;
                const asn = location ? location.org : 'Không rõ';
                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start flex-wrap">
                        <div class="me-3 mb-2 flex-grow-1">
                            <div class="name-view-mode"><strong>${name}</strong><button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-name" title="Sửa tên">✏️</button></div>
                            <div class="name-edit-mode" style="display:none;"><input type="text" class="form-control form-control-sm edit-name-input" value="${escapedName}" placeholder="Nhập tên..."></div>
                            <small class="text-muted d-block">${member.nodeId}</small>
                            <div class="mt-2">
                                <div class="ip-view-mode"><small>IP ảo: ${ip}</small><button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-ip" title="Sửa IP ảo">✏️</button></div>
                                <div class="ip-edit-mode" style="display:none;"><input type="text" class="form-control form-control-sm edit-ip-input" value="${ip}" placeholder="Nhập IP, cách nhau bởi dấu ,"></div>
                                <small class="text-info d-block">Physical IP: ${physicalAddress}</small>
                                <small class="text-primary d-block">📍 Vị trí: ${locationString}</small>
                                <small class="text-secondary d-block">🏢 ASN: ${asn}</small>
                                <small class="text-success d-block">Last Seen: ${formatTimeAgo(lastSeen)}</small>
                            </div>
                        </div>
                        <div class="d-flex flex-column align-items-end">
                            <div class="view-mode-controls mb-2">
                                 ${!authorizedStatus ? `<div class="mb-2"><input type="text" class="form-control form-control-sm new-member-name-input" placeholder="Đặt tên & Duyệt"></div>` : ''}
                                <div class="d-flex align-items-center">
                                    <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                                    <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}</button>
                                </div>
                            </div>
                            <div class="name-edit-mode" style="display:none;"><button class="btn btn-sm btn-success" data-action="save-name">💾 Lưu Tên</button><button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-name">Hủy</button></div>
                            <div class="ip-edit-mode" style="display:none;"><button class="btn btn-sm btn-success" data-action="save-ip">💾 Lưu IP</button><button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-ip">Hủy</button></div>
                        </div>
                    </div>`;
                memberList.appendChild(li);
            });
        } catch (error) { if (!isBackground) { console.error('Error loading members:', error); alert('Failed to load members.'); } }
        showLoading(false, isBackground);
    };

    const updateMember = async (networkId, memberId, payload) => { /* ... Giữ nguyên ... */ };
    const toggleEditState = (listItem, field, isEditing) => { /* ... Giữ nguyên ... */ };

    // --- EVENT LISTENERS ---

    // Event listener cho dropdown chọn network được nâng cấp
    networkSelect.addEventListener('change', () => {
        const networkId = networkSelect.value;
        if (!networkId || networkId.includes('...')) return;
        if (refreshIntervalId) clearInterval(refreshIntervalId);
        loadMembers(networkId, false); // Lần đầu tải thì hiện spinner
        const refreshIntervalMs = 1 * 60 * 1000; // 1 phút
        refreshIntervalId = setInterval(() => {
            console.log(`Auto-refreshing members for network ${networkId}...`);
            loadMembers(networkId, true); // Các lần sau làm mới trong nền
        }, refreshIntervalMs);
    });

    memberList.addEventListener('click', (event) => { /* ... Giữ nguyên ... */ });
    
    // Bắt đầu quy trình
    loadNetworks();
});
