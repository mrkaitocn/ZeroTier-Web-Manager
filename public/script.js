// public/script.js - PHIÊN BẢN HOÀN CHỈNH - ĐÃ SỬA LỖI VÀ TỔNG HỢP TÍNH NĂNG

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
    // --- KHAI BÁO BIẾN ---
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev';
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    let refreshIntervalId = null;
    let currentNetworkId = null;
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    // --- CÁC HÀM TIỆN ÍCH ---
    const showLoading = (isLoading, isBackground = false) => {
        if (isLoading && !isBackground) {
            loading.style.display = 'block';
            memberHeader.style.display = 'none';
            memberList.innerHTML = '';
        } else if (!isLoading) {
            loading.style.display = 'none';
        }
    };
    
    // Hàm này được viết lại để ẩn/hiện các phần tử một cách an toàn
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
