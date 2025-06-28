// public/script.js - Phiên bản v1.3 ổn định, tương thích Worker

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
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    let refreshIntervalId = null;
    let currentNetworkId = null;
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    const showLoading = (isLoading, isBackground = false) => {
        if (isLoading && !isBackground) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else if (!isLoading) {
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
            await loadMembers(networkId, true); // Tải lại trong nền để mượt hơn
        } catch (error) {
            console.error('Error updating member:', error);
            alert(`Lỗi: ${error.message}`);
            if(memberElement) memberElement.style.opacity = '1';
        }
    };

    const loadMembers = async (networkId, isBackground = false) => {
        showLoading(true, isBackground);
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

                li.innerHTML = `
                    <div class="item-wrapper">
                        <div class="info-block">
                            <strong>${name}</strong>
                            <br><small class="text-muted">${member.nodeId}</small>
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
            if (!isBackground) {
                console.error('Error loading members:', error);
                alert('Failed to load members.');
            }
        }
        showLoading(false, isBackground);
    };

    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        try {
            const response = await fetch(`${WORKER_URL}/get-networks`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const networks = await response.json();
            networkSelect.innerHTML = '<option value="">Chọn một network...</option>';
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
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks.');
        }
        showLoading(false);
    };

    function stopAutoRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
            console.log('Auto-refresh stopped.');
        }
    }

    function startAutoRefresh() {
        if (currentNetworkId && !refreshIntervalId) {
            console.log(`Auto-refresh started for ${currentNetworkId}. Interval: ${REFRESH_INTERVAL_MS / 1000}s`);
            refreshIntervalId = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    console.log(`Auto-refreshing members...`);
                    loadMembers(currentNetworkId, true);
                }
            }, REFRESH_INTERVAL_MS);
        }
    }

    networkSelect.addEventListener('change', () => {
        currentNetworkId = networkSelect.value;
        if (currentNetworkId) {
            stopAutoRefresh();
            loadMembers(currentNetworkId, false);
            startAutoRefresh();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopAutoRefresh();
        } else {
            if (currentNetworkId) {
                console.log('Tab is visible again. Refreshing data now.');
                loadMembers(currentNetworkId, true);
                startAutoRefresh();
            }
        }
    });

    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button && button.dataset.action === 'authorize') {
            const listItem = button.closest('.list-group-item');
            const memberId = listItem.id.replace('member-', '');
            const networkId = networkSelect.value;
            const shouldAuthorize = button.dataset.authorize === 'true';
            updateMember(networkId, memberId, { authorize: shouldAuthorize });
        }
    });
    
    loadNetworks();
});
