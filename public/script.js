function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');
    const showLoading = (isLoading) => { loading.style.display = isLoading ? 'block' : 'none'; if (isLoading) { memberHeader.style.display = 'none'; memberList.innerHTML = ''; } };
    const loadNetworks = async () => { showLoading(true); networkSelect.disabled = true; try { const response = await fetch('/.netlify/functions/get-networks'); if (!response.ok) throw new Error(`Server responded with ${response.status}`); const networks = await response.json(); networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>'; networks.forEach(net => { const option = document.createElement('option'); option.value = net.id; option.textContent = `${net.config.name || 'Unnamed Network'} (${net.id})`; networkSelect.appendChild(option); }); networkSelect.disabled = false; if (networks.length === 1) { networkSelect.selectedIndex = 1; networkSelect.dispatchEvent(new Event('change')); } } catch (error) { console.error('Error loading networks:', error); alert('Failed to load networks.'); } showLoading(false); };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) { memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào trong network này.</li>'; return; }
            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.id}`;

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                const authorizedStatus = member.config.authorized;
                const lastSeen = member.lastSeen;
                const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                const location = member.location;
                let locationString = 'Không rõ vị trí';
                if (location && location.city) locationString = `${location.city}, ${location.country}`;
                const asn = location ? location.asn : null;
                let asnString = 'Không rõ';
                if (asn && asn.name) asnString = `${asn.asn} - ${asn.name}`;

                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start flex-wrap">
                        <div class="me-3 mb-2 flex-grow-1">
                            <div class="view-mode-item">
                                <strong>${name}</strong>
                                <button class="btn btn-link btn-sm p-0 ms-2" data-action="edit-name" title="Sửa tên">✏️</button>
                            </div>
                            <div class="edit-mode-item" style="display:none;">
                                <input type="text" class="form-control form-control-sm" value="${name}" placeholder="Nhập tên gợi nhớ...">
                            </div>
                            <small class="text-muted d-block">${member.id}</small>
                            <div class="mt-2">
                                <small>IP ảo: ${ip}</small><br>
                                <small class="text-info">Physical IP: ${physicalAddress}</small><br>
                                <small class="text-primary">📍 Vị trí: ${locationString}</small><br>
                                <small class="text-secondary">🏢 ASN: ${asnString}</small><br>
                                <small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center mt-2">
                            ${!authorizedStatus ? `<div class="me-2"><input type="text" class="form-control form-control-sm" id="new-name-${member.id}" placeholder="Đặt tên & Duyệt"></div>` : ''}
                            <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                            <div class="view-mode-item">
                                <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">
                                    ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                                </button>
                            </div>
                            <div class="edit-mode-item" style="display:none;">
                                <button class="btn btn-sm btn-success" data-action="save-name">💾 Lưu</button>
                                <button class="btn btn-sm btn-secondary ms-1" data-action="cancel-edit">Hủy</button>
                            </div>
                        </div>
                    </div>
                `;
                memberList.appendChild(li);
            });
        } catch (error) { console.error('Error loading members:', error); alert('Failed to load members.'); }
        showLoading(false);
    };

    const updateMember = async (networkId, memberId, payload) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        memberElement.style.opacity = '0.5';
        try {
            const response = await fetch('/.netlify/functions/authorize-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ networkId, memberId, ...payload })
            });
            if (!response.ok) throw new Error('Cập nhật thất bại');
            await loadMembers(networkId);
        } catch (error) {
            console.error('Error updating member:', error);
            alert(error.message);
            memberElement.style.opacity = '1';
        }
    };
    
    const toggleEditMode = (memberId, isEditing) => {
        const memberElement = document.getElementById(`member-${memberId}`);
        const viewItems = memberElement.querySelectorAll('.view-mode-item');
        const editItems = memberElement.querySelectorAll('.edit-mode-item');
        if (isEditing) {
            viewItems.forEach(el => el.style.display = 'none');
            editItems.forEach(el => el.style.display = 'inline-block');
            memberElement.querySelector('input[type="text"]').focus();
        } else {
            editItems.forEach(el => el.style.display = 'none');
            viewItems.forEach(el => el.style.display = 'inline-block');
        }
    };

    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const memberId = button.closest('.list-group-item').id.replace('member-', '');
        const networkId = networkSelect.value;
        const action = button.dataset.action;

        switch (action) {
            case 'authorize': {
                const shouldAuthorize = button.dataset.authorize === 'true';
                let payload = { authorize: shouldAuthorize };
                if (shouldAuthorize) {
                    const nameInput = document.getElementById(`new-name-${memberId}`);
                    if (nameInput && nameInput.value.trim() !== '') payload.name = nameInput.value.trim();
                }
                updateMember(networkId, memberId, payload);
                break;
            }
            case 'edit-name': toggleEditMode(memberId, true); break;
            case 'save-name': {
                const nameInput = document.querySelector(`#member-${memberId} .edit-mode-item input[type="text"]`);
                updateMember(networkId, memberId, { name: nameInput.value.trim() });
                break;
            }
            case 'cancel-edit': toggleEditMode(memberId, false); break;
        }
    });
    
    networkSelect.addEventListener('change', () => { if(networkSelect.value) loadMembers(networkSelect.value); });
    loadNetworks();
});
