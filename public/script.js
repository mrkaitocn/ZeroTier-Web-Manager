function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading) => { loading.style.display = isLoading ? 'block' : 'none'; if (isLoading) { memberHeader.style.display = 'none'; memberList.innerHTML = ''; } };

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

            // === TÍNH NĂNG MỚI: TỰ ĐỘNG CHỌN NẾU CHỈ CÓ 1 NETWORK ===
            if (networks.length === 1) {
                networkSelect.selectedIndex = 1; // Chọn network đầu tiên
                networkSelect.dispatchEvent(new Event('change')); // Giả lập sự kiện 'change' để tải members
            }
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks.');
        }
        showLoading(false);
    };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
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
                li.className = 'list-group-item'; // CSS Grid sẽ xử lý phần còn lại

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                const authorizedStatus = member.config.authorized;
                const lastSeen = member.lastSeen;
                const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                
                const location = member.location;
                let locationString = 'Không rõ vị trí';
                if (location && location.city) {
                    locationString = `${location.city}, ${location.country}`;
                }
                // === TÍNH NĂNG MỚI: LẤY THÔNG TIN ASN ===
                const asn = location ? location.asn : null;
                let asnString = 'Không rõ';
                if (asn && asn.name) {
                    asnString = `${asn.asn} - ${asn.name}`;
                }

                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start flex-wrap">
                        <div class="me-3 mb-2">
                            <strong>${name}</strong>
                            <br><small class="text-muted">${member.nodeId}</small>
                            <br><small>IP ảo: ${ip}</small>
                            <br><small class="text-info">Physical IP: ${physicalAddress}</small>
                            <br><small class="text-primary">📍 Vị trí: ${locationString}</small>
                            <br><small class="text-secondary">🏢 ASN: ${asnString}</small>
                            <br><small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                            <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-member-id="${member.nodeId}" data-authorize="${!authorizedStatus}">
                                ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                            </button>
                        </div>
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

    const toggleAuthorization = async (networkId, memberId, shouldAuthorize) => {
        const button = document.querySelector(`button[data-member-id='${memberId}']`);
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
            await fetch('/.netlify/functions/authorize-member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ networkId, memberId, authorize: shouldAuthorize }) });
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
