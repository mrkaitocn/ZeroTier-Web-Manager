// public/script.js - Phiên bản sửa lỗi không hiển thị nút Lưu

function formatTimeAgo(timestamp) { if (!timestamp || timestamp === 0) return 'Chưa bao giờ'; const now = new Date(); const seenTime = new Date(timestamp); const seconds = Math.floor((now - seenTime) / 1000); if (seconds < 60) return "Vài giây trước"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút trước`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ trước`; const days = Math.floor(hours / 24); if (days < 30) return `${days} ngày trước`; return seenTime.toLocaleDateString('vi-VN'); }

document.addEventListener('DOMContentLoaded', () => {
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    const showLoading = (isLoading) => { loading.style.display = isLoading ? 'block' : 'none'; if (isLoading) { memberHeader.style.display = 'none'; memberList.innerHTML = ''; } };
    const loadNetworks = async () => { showLoading(true); networkSelect.disabled = true; try { const response = await fetch('/.netlify/functions/get-networks'); if (!response.ok) throw new Error(`Server responded with ${response.status}`); const networks = await response.json(); networkSelect.innerHTML = '<option selected disabled>Chọn một network...</option>'; networks.forEach(net => { const option = document.createElement('option'); option.value = net.id; option.textContent = `<span class="math-inline">\{net\.config\.name \|\| 'Unnamed Network'\} \(</span>{net.id})`; networkSelect.appendChild(option); }); networkSelect.disabled = false; if (networks.length === 1) { networkSelect.selectedIndex = 1; networkSelect.dispatchEvent(new Event('change')); } } catch (error) { console.error('Error loading networks:', error); alert('Failed to load networks.'); } showLoading(false); };

    const loadMembers = async (networkId) => {
        showLoading(true);
        try {
            const response = await fetch(`/.netlify/functions/get-members?networkId=${networkId}`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const members = await response.json();
            
            memberList.innerHTML = '';
            memberHeader.style.display = 'block';
            if (members.length === 0) { memberList.innerHTML = '<li class="list-group-item">Không có thành viên nào.</li>'; return; }
            members.sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.id = `member-${member.nodeId}`;

                const name = member.name || 'Chưa đặt tên';
                const escapedName = name.replace(/"/g, '&quot;');
                const ip = member
