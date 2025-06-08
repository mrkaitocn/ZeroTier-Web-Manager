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
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
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

    // === HÀM loadNetworks ĐÃ ĐƯỢC SỬA LỖI LOGIC ===
    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        let networks = []; // Khởi tạo mảng networks

        try {
            const response = await fetch('/.netlify/functions/get-networks');
            if (!response.ok) {
                // Nếu fetch lỗi, ném ra lỗi để nhảy vào khối catch
                throw new Error(`Server responded with ${response.status}`);
            }
            
            networks = await response.json();

            if (networks.length === 1) {
                const singleNetwork = networks[0];
                const option = document.createElement('option');
                option.value = singleNetwork.id;
                option.textContent = `${singleNetwork.config.name || 'Unnamed Network'} (${singleNetwork.id})`;
                networkSelect.innerHTML = ''; // Xóa các lựa chọn cũ
                networkSelect.appendChild(option);
                networkSelect.value = singleNetwork.id;

                document.querySelector('label[for="network-select"]').style.display = 'none';
                networkSelect.style.display = 'none';

                loadMembers(singleNetwork.id);
            } else {
                // Áp dụng cho 0 hoặc nhiều hơn 1 network
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
            // Nếu có lỗi, đảm bảo dropdown trống và có placeholder
             networkSelect.innerHTML = '<option selected disabled>Không thể tải network...</option>';
        } finally {
            // DÙ THÀNH CÔNG HAY THẤT BẠI, KHỐI NÀY LUÔN CHẠY
            showLoading(false);
            // Luôn kích hoạt lại dropdown nếu không phải trường hợp chỉ có 1 network
            if (networks.length !== 1) {
                networkSelect.disabled = false;
            }
        }
    };

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
                memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào trong network này.</li>';
            } else {
                members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));
                members.forEach(member => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap';
                    const name = member.name || 'Chưa đặt tên';
                    const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                    const authorizedStatus = member.config.authorized;
                    const lastSeen = member.lastSeen;
                    const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                    li.innerHTML = `
                        <div class="me-3 mb-2"><strong>${name}</strong><br><small class="text-muted">${member.nodeId}</small><br><small>IP ảo: ${ip}</small><br><small class="text-info">Physical IP: ${physicalAddress}</small><br><small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small></div>
                        <div class="d-flex align-items-center"><span class="me-3 authorized-${authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span><button class="btn btn-sm ${authorizedStatus ? 'btn-outline-danger' : 'btn-outline-success'}" data-member-id="${member.nodeId}" data-authorize="${!authorizedStatus}">${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}</button></div>
                    `;
                    memberList.appendChild(li);
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
            const networkId = currentNetworkId; // Luôn lấy network ID hiện tại
            toggleAuthorization(networkId, memberId, shouldAuthorize);
        }
    });

    loadNetworks();
});
