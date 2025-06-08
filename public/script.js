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
// Lưu lại ID của network đang được chọn để refresh
let currentNetworkId = null; 
// Lưu lại ID của lịch trình setInterval để có thể xóa khi cần
let refreshIntervalId = null;


document.addEventListener('DOMContentLoaded', () => {
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading, isRefreshing = false) => {
        // Nếu chỉ là refresh, không hiển thị icon loading lớn
        if (!isRefreshing) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
        if (isLoading && !isRefreshing) {
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        }
    };

    // === CẬP NHẬT HÀM loadNetworks ĐỂ TỰ ĐỘNG CHỌN ===
    const loadNetworks = async () => {
        showLoading(true);
        networkSelect.disabled = true;
        try {
            const response = await fetch('/.netlify/functions/get-networks');
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            
            const networks = await response.json();

            // KIỂM TRA NẾU CHỈ CÓ 1 NETWORK
            if (networks.length === 1) {
                const singleNetwork = networks[0];
                // Thêm network đó vào dropdown và chọn sẵn
                const option = document.createElement('option');
                option.value = singleNetwork.id;
                option.textContent = `<span class="math-inline">\{singleNetwork\.config\.name \|\| 'Unnamed Network'\} \(</span>{singleNetwork.id})`;
                networkSelect.appendChild(option);
                networkSelect.value = singleNetwork.id;

                // Ẩn label và dropdown đi cho gọn
                document.querySelector('label[for="network-select"]').style.display = 'none';
                networkSelect.style.display = 'none';

                // TỰ ĐỘNG TẢI THÀNH VIÊN NGAY LẬP TỨC
                loadMembers(singleNetwork.id);
            } else {
                // Nếu có nhiều hơn 1 network, hoạt động như cũ
                networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>';
                networks.forEach(net => {
                    const option = document.createElement('option');
                    option.value = net.id;
                    option.textContent = `<span class="math-inline">\{net\.config\.name \|\| 'Unnamed Network'\} \(</span>{net.id})`;
                    networkSelect.appendChild(option);
                });
                networkSelect.disabled = false;
            }
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks. Vui lòng kiểm tra lại Console (F12) để xem chi tiết lỗi.');
        }
        showLoading(false);
    };

    // === CẬP NHẬT HÀM loadMembers ĐỂ TỰ ĐỘNG REFRESH ===
    const loadMembers = async (networkId, isRefreshing = false) => {
        // Lưu lại ID của network hiện tại
        currentNetworkId = networkId;
        showLoading(true, isRefreshing);

        // Mỗi lần load, hủy lịch trình refresh cũ (nếu có)
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
                        <div class="me-3 mb-2">
                            <strong><span class="math-inline">\{name\}</strong\><br\>
<small class\="text\-muted"\></span>{member.nodeId}</small><br>
                            <small>IP ảo: ${ip}</small><br>
                            <small class="text-info">Physical IP: ${physicalAddress}</small><br>
                            <small class="text-success">Last Seen: <span class="math-inline">\{formatTimeAgo\(lastSeen\)\}</small\>
</div\>
<div class\="d\-flex align\-items\-center"\>
<span class\="me\-3 authorized\-</span>{authorizedStatus}">${authorizedStatus ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                            <button class="btn btn-sm <span class="math-inline">\{authorizedStatus ? 'btn\-outline\-danger' \: 'btn\-outline\-success'\}" data\-member\-id\="</span>{member.nodeId}" data-authorize="${!authorizedStatus}">
                                ${authorizedStatus ? 'Hủy duyệt' : 'Duyệt'}
                            </button>
                        </div>
                    `;
                    memberList.appendChild(li);
                });
            }
            
            // SAU KHI LOAD THÀNH CÔNG, LÊN LỊCH REFRESH MỚI SAU 5 PHÚT
            const refreshTime = 5 * 60 * 1000; // 5 phút
            refreshIntervalId = setInterval(() => {
                console.log(`Tự động làm mới danh sách thành viên lúc ${new Date().toLocaleTimeString('vi-VN')}`);
                loadMembers(currentNetworkId, true); // Gọi lại chính nó với cờ isRefreshing = true
            }, refreshTime);
            
        } catch (error) {
            console.error('Error loading members:', error);
            // Nếu có lỗi, dừng việc tự động refresh để tránh lặp lại lỗi
            if (refreshIntervalId) clearInterval(refreshIntervalId);
        } finally {
            showLoading(false, isRefreshing);
        }
    };

    const toggleAuthorization = async (networkId, memberId
