// public/script.js - Phiên bản khôi phục cơ bản

document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO BIẾN ---
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    // --- CÁC HÀM ---
    const showLoading = (isLoading) => {
        if (isLoading) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else {
            loading.style.display = 'none';
        }
    };

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
            if(memberElement) memberElement.style.opacity = '1';
        }
    };

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
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.id = `member-${member.nodeId}`;

                const name = member.name || 'Chưa đặt tên';
                const authorizedStatus = member.config.authorized;

                li.innerHTML = `
                    <div>
                        <strong>${name}</strong>
                        <br>
                        <small class="text-muted">${member.nodeId}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="me-3 ${authorizedStatus ? 'text-success' : 'text-danger'}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                        <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-action="authorize" data-authorize="${!authorizedStatus}">
                            ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                        </button>
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
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks.');
        }
        showLoading(false);
    };

    // --- EVENT LISTENERS ---
    networkSelect.addEventListener('change', () => {
        const networkId = networkSelect.value;
        if (networkId && !networkId.includes('...')) {
            loadMembers(networkId);
        }
    });

    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.action === 'authorize') {
            const listItem = button.closest('.list-group-item');
            const memberId = listItem.id.replace('member-', '');
            const networkId = networkSelect.value;
            const shouldAuthorize = button.dataset.authorize === 'true';
            updateMember(networkId, memberId, { authorize: shouldAuthorize });
        }
    });
    
    // Bắt đầu
    loadNetworks();
});
