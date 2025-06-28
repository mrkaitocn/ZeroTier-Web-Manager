// public/script.js - PHIÊN BẢN CUỐI CÙNG, ĐÃ SẮP XẾP LẠI VÀ SỬA LỖI

// Hàm tiện ích định dạng thời gian
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

// Hàm tiện ích tạo phần tử DOM
function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
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

    // --- CÁC HÀM TIỆN ÍCH TRONG SCOPE ---
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
            // Tải lại để khôi phục trạng thái nếu có lỗi
            if (currentNetworkId) await loadMembers(currentNetworkId);
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
                const li = createElement('li', 'list-group-item');
                li.id = `member-${member.nodeId}`;

                const name = member.name || 'Chưa đặt tên';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : '';
                const authorizedStatus = member.config.authorized;

                const wrapper
