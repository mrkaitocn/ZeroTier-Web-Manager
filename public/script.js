// ... (Hàm formatTimeAgo và các biến toàn cục giữ nguyên) ...

document.addEventListener('DOMContentLoaded', () => {
    const memberList = document.getElementById('member-list');
    const networkSelect = document.getElementById('network-select');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');
    
    // ... (hàm showLoading, loadNetworks, toggleAuthorization giữ nguyên như phiên bản trước) ...
    // ... Hãy đảm bảo chúng là phiên bản đã sửa lỗi logic ở các bước trước ...
    
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
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col-12 col-lg-6 mb-3'; // Thêm mb-3 để có khoảng cách
                    
                    const name = member.name || 'Chưa đặt tên';
                    const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'Chưa có IP';
                    const authorizedStatus = member.config.authorized;
                    const lastSeen = member.lastSeen;
                    const physicalAddress = member.physicalAddress ? member.physicalAddress.split('/')[0] : 'N/A';
                    
                    const history = member.history;
                    let historyHtml = '<p class="card-text mb-2"><small class="text-secondary">Chưa có dữ liệu lịch sử.</small></p>';
                    if (history && history.timestamp) {
                        const eventTime = new Date(history.timestamp).toLocaleString('vi-VN');
                        if (history.status === 'online') {
                            historyHtml = `<p class="card-text mb-2"><small class="text-primary fw-bold">Online từ: ${eventTime}</small></p>`;
                        } else {
                            historyHtml = `<p class="card-text mb-2"><small class="text-muted">Offline từ: ${eventTime}</small></p>`;
                        }
                    }

                    columnDiv.innerHTML = `
                        <div class="card h-100">
                            <div class="card-body d-flex flex-column justify-content-between">
                                <div>
                                    <h5 class="card-title">${name}</h5>
                                    <h6 class="card-subtitle mb-2 text-muted">${member.nodeId}</h6>
                                    <p class="card-text mb-1"><small>IP ảo: ${ip}</small></p>
                                    <p class="card-text mb-1"><small class="text-info">Physical IP: ${physicalAddress}</small></p>
                                    <p class="card-text mb-2"><small class="text-success">Last Seen: ${formatTimeAgo(lastSeen)}</small></p>
                                    ${historyHtml}
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
                loadMembers(currentNetworkId, true);
            }, refreshTime);
            
        } catch (error) {
            console.error('Error loading members:', error);
            if (refreshIntervalId) clearInterval(refreshIntervalId);
        } finally {
            showLoading(false, isRefreshing);
        }
    };
    
    // ... (Các hàm và event listener khác)
    loadNetworks();
});
