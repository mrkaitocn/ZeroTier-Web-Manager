// public/script.js - Nâng cấp Bước 3: Thêm tính năng quản lý nâng cao

function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading) => { /* ... Giữ nguyên ... */ };
    const loadNetworks = async () => { /* ... Giữ nguyên ... */ };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`${WORKER_URL}/get-members?networkId=${networkId}`);
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
                // ... (các biến khác giữ nguyên)

                li.innerHTML = `
                    <div class="item-wrapper">
                        <div class="info-block">
                            <div class="name-view-mode">
                                <strong>${name}</strong>
                                <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-name" title="Sửa tên">✏️</button>
                            </div>
                            <div class="name-edit-mode" style="display:none;">
                                <input type="text" class="form-control form-control-sm edit-name-input" value="${escapedName}" placeholder="Nhập tên...">
                            </div>

                            <small class="text-muted d-block">${member.nodeId}</small>
                            
                            <div class="mt-2">
                                <div class="ip-view-mode">
                                    <small>IP ảo: ${ip}</small>
                                    <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-ip" title="Sửa IP ảo">✏️</button>
                                </div>
                                <div class="ip-edit-mode" style="display:none;">
                                    <input type="text" class="form-control form-control-sm edit-ip-input" value="${ip}" placeholder="Nhập IP, cách nhau bởi dấu ,">
                                </div>
                                ...
                            </div>
                        </div>
                        <div class="action-block">
                            <div class="view-mode-controls">
                                 ${!authorizedStatus ? `<div class="mb-2"><input type="text" class="form-control form-control-sm new-member-name-input" placeholder="Đặt tên & Duyệt"></div>` : ''}
                                <div class="d-flex align-items-center">
                                    <span class="me-3 ${authorizedStatus ? 'text-success' : 'text-danger'}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                                    <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}</button>
                                </div>
                            </div>
                            <div class="name-edit-mode" style="display:none;">
                                <button class="btn btn-sm btn-success" data-action="save-name">💾 Lưu Tên</button>
                                <button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-name">Hủy</button>
                            </div>
                            <div class="ip-edit-mode" style="display:none;">
                                <button class="btn btn-sm btn-success" data-action="save-ip">💾 Lưu IP</button>
                                <button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-ip">Hủy</button>
                            </div>
                        </div>
                    </div>`;
                memberList.appendChild(li);
            });
        } catch (error) { /* ... */ }
        showLoading(false);
    };

    const updateMember = async (networkId, memberId, payload) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        if(memberElement) memberElement.style.opacity = '0.5';
        try {
            const response = await fetch(`${WORKER_URL}/authorize-member`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ networkId, memberId, ...payload }) });
            if (!response.ok) { const errorText = await response.text(); throw new Error(errorText || 'Cập nhật thất bại'); }
            await loadMembers(networkId);
        } catch (error) {
            console.error('Error updating member:', error);
            alert(`Lỗi: ${error.message}`);
            if(memberElement) memberElement.style.opacity = '1';
        }
    };
    
    // Hàm mới để bật/tắt chế độ sửa, tổng quát hơn
    const toggleEditState = (listItem, field, isEditing) => {
        const viewItems = listItem.querySelectorAll(`.${field}-view-mode`);
        const editItems = listItem.querySelectorAll(`.${field}-edit-mode`);
        const mainControls = listItem.querySelector('.view-mode-controls');
        
        viewItems.forEach(el => el.style.display = isEditing ? 'none' : '');
        editItems.forEach(el => el.style.display = 'flex'); // Dùng flex để các nút nằm cạnh nhau
        if(mainControls) mainControls.style.display = isEditing ? 'none' : 'block';
        if (isEditing) {
            listItem.querySelector(`.edit-${field}-input`).focus();
        }
    };

    networkSelect.addEventListener('change', () => { /* ... Giữ nguyên ... */ });

    // Event listener chính được mở rộng để xử lý tất cả các hành động
    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const listItem = button.closest('.list-group-item');
        const memberId = listItem.id.replace('member-', '');
        const networkId = networkSelect.value;
        const action = button.dataset.action;

        switch (action) {
            case 'authorize': {
                const shouldAuthorize = button.dataset.authorize === 'true';
                let payload = { authorize: shouldAuthorize };
                if (shouldAuthorize) {
                    const nameInput = listItem.querySelector('.new-member-name-input');
                    if (nameInput && nameInput.value.trim() !== '') {
                        payload.name = nameInput.value.trim();
                    }
                }
                updateMember(networkId, memberId, payload);
                break;
            }
            case 'edit-name': toggleEditState(listItem, 'name', true); break;
            case 'save-name': {
                const nameInput = listItem.querySelector('.edit-name-input');
                updateMember(networkId, memberId, { name: nameInput.value.trim() });
                break;
            }
            case 'cancel-edit-name': toggleEditState(listItem, 'name', false); break;
            
            case 'edit-ip': toggleEditState(listItem, 'ip', true); break;
            case 'save-ip': {
                const ipInput = listItem.querySelector('.edit-ip-input');
                const newIps = ipInput.value.split(',').map(ip => ip.trim()).filter(ip => ip);
                updateMember(networkId, memberId, { ip_assignments: newIps });
                break;
            }
            case 'cancel-edit-ip': toggleEditState(listItem, 'ip', false); break;
        }
    });
    
    loadNetworks();
});
