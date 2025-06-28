// public/script.js - Phiên bản cuối cùng, đã sửa lỗi và thêm đầy đủ tính năng

function formatTimeAgo(timestamp) {
    if (!timestamp || timestamp === 0) return 'Chưa bao giờ';
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
    // --- KHAI BÁO BIẾN ---
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    let refreshIntervalId = null;
    let currentNetworkId = null;
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    // --- CÁC HÀM TIỆN ÍCH ---
    const showLoading = (isLoading, isBackground = false) => {
        if (isLoading && !isBackground) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else if (!isLoading) {
            loading.style.display = 'none';
        }
    };
    
    const toggleEditState = (listItem, field, isEditing) => {
        const viewItems = listItem.querySelectorAll(`.${field}-view-mode`);
        const editItems = listItem.querySelectorAll(`.${field}-edit-mode`);
        const mainControls = listItem.querySelector('.view-mode-controls');
        
        viewItems.forEach(el => { el.style.display = isEditing ? 'none' : '' });
        editItems.forEach(el => { el.style.display = isEditing ? 'flex' : 'none' });
        
        if (mainControls) {
            mainControls.style.display = isEditing ? 'none' : 'block';
        }
        
        if (isEditing) {
            listItem.querySelector(`.edit-${field}-input`).focus();
        }
    };

    // --- CÁC HÀM XỬ LÝ DỮ LIỆU ---
    const updateMember = async (networkId, memberId, payload) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        if(memberElement) memberElement.style.opacity = '0.5';
        try {
            const response = await fetch(`${WORKER_URL}/authorize-member`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ networkId, memberId, ...payload })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Cập nhật thất bại');
            }
            await loadMembers(networkId);
        } catch (error) {
            console.error('Error updating member:', error);
            alert(`Lỗi: ${error.message}`);
            if (currentNetworkId) {
                loadMembers(currentNetworkId);
            } else if(memberElement) {
                memberElement.style.opacity = '1';
            }
        }
    };
    
    const loadMembers = async (networkId, isBackground = false) => {
        showLoading(true, isBackground);
        try {
            const response = await fetch(`${WORKER_URL}/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            const focusedElement = document.activeElement;
            const focusedItem = focusedElement ? focusedElement.closest('.list-group-item') : null;
            const focusedMemberId = focusedItem ? focusedItem.id : null;
            const isEditingName = focusedItem ? focusedItem.querySelector('.name-edit-mode').style.display !== 'none' : false;
            const isEditingIp = focusedItem ? focusedItem.querySelector('.ip-edit-mode').style.display !== 'none' : false;

            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) { memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào.</li>'; return; }
            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.nodeId}`;

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : '';
                const authorizedStatus = member.config.authorized;
                
                li.innerHTML = `
                    <div class="item-wrapper">
                        <div class="info-block">
                            <div class="name-view-mode" style="display: flex; align-items: center;">
                                <strong>${name}</strong>
                                <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-name" title="Sửa tên">✏️</button>
                            </div>
                            <div class="name-edit-mode">
                                <input type="text" class="form-control form-control-sm edit-name-input" value="${name.replace(/"/g, '&quot;')}" placeholder="Nhập tên...">
                            </div>
                            <small class="text-muted d-block">${member.nodeId}</small>
                            <div class="mt-2">
                                <div class="ip-view-mode" style="display: flex; align-items: center;">
                                    <small>IP ảo: ${ip || 'Chưa có IP'}</small>
                                    <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-ip" title="Sửa IP ảo">✏️</button>
                                </div>
                                <div class="ip-edit-mode">
                                    <input type="text" class="form-control form-control-sm edit-ip-input" value="${ip}" placeholder="10.0.0.1,10.0.0.2">
                                </div>
                                </div>
                        </div>
                        <div class="action-block">
                             <div class="view-mode-controls">
                                 ${!authorizedStatus ? `<div class="mb-2"><input type="text" class="form-control form-control-sm new-member-name-input" placeholder="Đặt tên & Duyệt"></div>` : ''}
                                <div class="d-flex align-items-center">
                                    <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                                    <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}</button>
                                </div>
                            </div>
                            <div class="name-edit-mode" style="display: none;"><button class="btn btn-sm btn-success" data-action="save-name">💾 Lưu Tên</button><button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-name">Hủy</button></div>
                            <div class="ip-edit-mode" style="display: none;"><button class="btn btn-sm btn-success" data-action="save-ip">💾 Lưu IP</button><button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit-ip">Hủy</button></div>
                        </div>
                    </div>`;
                memberList.appendChild(li);
            });
            
            if (isBackground && focusedMemberId && document.getElementById(focusedMemberId)) {
                const focusedItemElement = document.getElementById(focusedMemberId);
                if (isEditingName) toggleEditState(focusedItemElement, 'name', true);
                if (isEditingIp) toggleEditState(focusedItemElement, 'ip', true);
            }

        } catch (error) { if (!isBackground) { console.error('Error loading members:', error); alert('Failed to load members.'); } }
        showLoading(false, isBackground);
    };

    const loadNetworks = async () => { /* ... Giữ nguyên ... */ };
    function stopAutoRefresh() { /* ... Giữ nguyên ... */ }
    function startAutoRefresh() { /* ... Giữ nguyên ... */ }

    // --- CÁC EVENT LISTENERS ---
    networkSelect.addEventListener('change', () => { /* ... Giữ nguyên ... */ });
    document.addEventListener('visibilitychange', () => { /* ... Giữ nguyên ... */ });
    memberList.addEventListener('click', (event) => { /* ... Giữ nguyên ... */ });
    
    loadNetworks();
});
