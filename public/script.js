// public/script.js - Phiên bản có thêm tính năng sửa IP ảo

function formatTimeAgo(timestamp) { /* ... Giữ nguyên ... */ }

document.addEventListener('DOMContentLoaded', () => {
    // ... (Các hằng số và hàm loadNetworks giữ nguyên)
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');
    const showLoading = (isLoading) => { /* ... Giữ nguyên ... */ };
    const loadNetworks = async () => { /* ... Giữ nguyên ... */ };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) { /* ... */ return; }
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
                    <div class="d-flex justify-content-between align-items-start flex-wrap">
                        <div class="me-3 mb-2 flex-grow-1">
                            <div class="name-view-mode">
                                <strong>${name}</strong>
                                <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-name" title="Sửa tên">✏️</button>
                            </div>
                            <div class="name-edit-mode" style="display:none;">
                                <input type="text" class="form-control form-control-sm edit-name-input" value="${escapedName}" placeholder="Nhập tên gợi nhớ...">
                            </div>
                            <small class="text-muted d-block">${member.nodeId}</small>
                            
                            <div class="mt-2">
                                <div class="ip-view-mode">
                                    <small>IP ảo: ${ip}</small>
                                    <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-ip" title="Sửa IP ảo">✏️</button>
                                </div>
                                <div class="ip-edit-mode" style="display:none;">
                                    <input type="text" class="form-control form-control-sm edit-ip-input" value="${ip}" placeholder="Nhập IP mới...">
                                </div>
                                <small class="text-info d-block">Physical IP: ...</small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center mt-2">
                             ${!authorizedStatus ? `<div class="me-2"><input type="text" class="form-control form-control-sm new-member-name-input" placeholder="Đặt tên & Duyệt"></div>` : ''}
                            <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                            <div class="name-view-mode ip-view-mode">
                                <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}</button>
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

    const updateMember = async (networkId, memberId, payload) => { /* ... Giữ nguyên ... */ };
    
    // --- HÀM MỚI: Bật/tắt chế độ sửa cho từng trường (tên hoặc IP) ---
    const toggleEditState = (memberId, field, isEditing) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        const viewItems = memberElement.querySelectorAll(`.${field}-view-mode`);
        const editItems = memberElement.querySelectorAll(`.${field}-edit-mode`);
        viewItems.forEach(el => el.style.display = isEditing ? 'none' : '');
        editItems.forEach(el => el.style.display = isEditing ? '' : 'flex');
        if (isEditing) {
            memberElement.querySelector(`.edit-${field}-input`).focus();
        }
    };

    networkSelect.addEventListener('change', () => { /* ... Giữ nguyên ... */ });
    
    // --- EVENT LISTENER CHÍNH ĐƯỢC MỞ RỘNG ---
    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const listItem = button.closest('.list-group-item');
        const memberId = listItem.id.replace('member-', '');
        const networkId = networkSelect.value;
        const action = button.dataset.action;

        switch (action) {
            case 'authorize': { /* ... Giữ nguyên ... */ break; }
            case 'edit-name': toggleEditState(memberId, 'name', true); break;
            case 'save-name': {
                const nameInput = listItem.querySelector('.edit-name-input');
                updateMember(networkId, memberId, { name: nameInput.value.trim() });
                break;
            }
            case 'cancel-edit-name': toggleEditState(memberId, 'name', false); break;
            
            // Các case mới cho việc sửa IP
            case 'edit-ip': toggleEditState(memberId, 'ip', true); break;
            case 'save-ip': {
                const ipInput = listItem.querySelector('.edit-ip-input');
                // Chuyển chuỗi IP (có thể có nhiều IP cách nhau bằng dấu phẩy) thành một mảng
                const newIps = ipInput.value.split(',').map(ip => ip.trim()).filter(ip => ip);
                updateMember(networkId, memberId, { ip_assignments: newIps });
                break;
            }
            case 'cancel-edit-ip': toggleEditState(memberId, 'ip', false); break;
        }
    });
    
    loadNetworks();
});
