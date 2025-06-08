// === HÀM HỖ TRỢ ĐỊNH DẠNG THỜI GIAN ===
function formatTimeAgo(timestamp) {
    if (!timestamp || timestamp === 0) {
        return 'Chưa bao giờ';
    }
    const now = new Date();
    const seenTime = new Date(timestamp);
    const seconds = Math.floor((now - seenTime) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) {
        return seenTime.toLocaleDateString('vi-VN');
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + " tháng trước";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + " ngày trước";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + " giờ trước";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + " phút trước";
    }
    return "Vài giây trước";
}

// === BIẾN TOÀN CỤC ĐỂ QUẢN LÝ TRẠNG THÁI ===
let currentNetworkId = null; 
let refreshIntervalId = null;

document.addEventListener('DOMContentLoaded', () => {
    const memberList = document.getElementById('member-list');
    const networkSelect = document.getElementById('network-select');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading, isRefreshing = false) => {
        if (!isRefreshing) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
        if (isLoading && !isRefreshing) {
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        }
    };

    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        let networks = [];

        try {
            const response = await fetch('/.netlify/functions/get-networks');
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            networks = await response.json();
            if (networks.length === 1) {
                const singleNetwork = networks[0];
                const option = document.createElement('option');
                option.value = singleNetwork.id;
                option.textContent = `${singleNetwork.config.name || 'Unnamed Network'} (${singleNetwork.id})`;
                networkSelect.innerHTML = '';
                networkSelect.appendChild(option);
                networkSelect.value = singleNetwork.id;
                document.querySelector('label[for="network-select"]').style.display = 'none';
                networkSelect.style.display = 'none';
                loadMembers(singleNetwork.id);
            } else {
                networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>';
                networks.forEach(net => {
                    const option = document.createElement('option');
                    option.value = net.id;
                    option.textContent = `${net.config.name || 'Unnamed Network'} (${net.id})`;
                    networkSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Không thể tải danh sách network. Vui lòng kiểm tra Console (F12) và thử tải lại trang.');
            networkSelect.innerHTML = '<option selected disabled>Không thể tải network...</option>';
        } finally {
            showLoading(false);
            if (networks.length !== 1) {
                networkSelect.disabled = false;
            }
        }
    };

    // === HÀM loadMembers ĐÃ ĐƯỢC CẬP NHẬT ĐỂ TẠO CỘT ===
    const loadMembers = async (networkId, isRefreshing = false) => {
        currentNetworkId = networkId;
        showLoading(true, isRefreshing);
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }

        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';

            if (members.length === 0) {
                memberList.innerHTML = '<div class="col-12"><div class="alert alert-info">Không có thành viên nào trong network này.</div></div>';
            } else {
                members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));
                members.forEach(member => {
                    // Tạo một div đóng vai trò là cột
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col-12 col-lg-6'; // 1 cột trên mobile, 2 cột trên PC

                    const name = member.name || 'Chưa đặt tên';
                    const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                    const authorizedStatus = member.config.authorized;
                    const lastSeen = member.lastSeen;
                    const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                    
                    // Tạo nội dung bên trong cột theo style "card" cho đẹp
                    columnDiv.innerHTML = `
                        <div class="card h-100">
                            <div class="card-body d-flex flex-column justify-content-between">
                                <div>
                                    <h5 class="card-title">${name}</h5>
                                    <h6 class="card-subtitle mb-2 text-muted">${member.nodeId}</h6>
                                    <p class="card-text mb-1"><small>IP ảo: ${ip}</small></p>
                                    <p class="card-text mb-1"><small class="text-info">Physical IP: ${physicalAddress}</small></p>
                                    <p class="card-text mb-2"><small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small></p>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mt-3">
                                    <span class="authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                                    <button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-member-id="${member.nodeId}" data-authorize="${!authorizedStatus}">
                                        ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    memberList.appendChild(columnDiv);
                });
            }
            
            const refreshTime = 5 * 60 * 1000;
            refreshIntervalId = setInterval(() => {
                console.log(`Tự động làm mới danh sách thành viên lúc ${new Date().toLocaleTimeString('vi-VN')}`);
                loadMembers(currentNetworkId, true);
            }, refreshTime);
            
        } catch (error) {
            console.error('Error loading members:', error);
            if (refreshIntervalId) clearInterval(refreshIntervalId);
        } finally {
            showLoading(false, isRefreshing);
        }
    };

    const toggleAuthorization = async (networkId, memberId, shouldAuthorize) => {
        const button = document.querySelector(`button[data-member-id='${memberId}']`);
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        try {
            const response = await fetch('/.netlify/functions/authorize-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ networkId, memberId, authorize: shouldAuthorize }),
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
        if (networkId && !networkSelect.options[networkSelect.selectedIndex].disabled) {
            loadMembers(networkId);
        }
    });

    memberList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button) {
            const memberId = button.dataset.memberId;
            const shouldAuthorize = button.dataset.authorize === 'true';
            const networkId = currentNetworkId;
            toggleAuthorization(networkId, memberId, shouldAuthorize);
        }
    });

    loadNetworks();
});
