document.addEventListener('DOMContentLoaded', () => {
    const deviceTableBody = document.getElementById('deviceTableBody');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');

    // Thay thế URL này bằng URL của Cloudflare Worker của bạn
    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev/'; // Ví dụ: https://zerotier-manager-api.yourusername.workers.dev

    // Tự động gọi fetchData khi trang được tải
    fetchData();

    async function fetchData() {
        deviceTableBody.innerHTML = ''; // Xóa nội dung cũ
        errorMessage.style.display = 'none';
        loadingSpinner.style.display = 'block';

        try {
            const response = await fetch(WORKER_URL); // Không cần truyền networkId nữa

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const devices = await response.json();
            renderTable(devices);

        } catch (error) {
            console.error('Error fetching data:', error);
            displayMessage(`Failed to fetch device data: ${error.message}`, 'danger');
            deviceTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading data.</td></tr>';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderTable(devices) {
        if (devices.length === 0) {
            deviceTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No devices found in this network.</td></tr>';
            return;
        }

        let html = '';
        devices.forEach(device => {
            html += `
                <tr>
                    <td>${device.name}</td>
                    <td>${device.zerotierIp}</td>
                    <td>${device.physicalIp}</td>
                    <td>${device.location}</td>
                    <td>${device.asn}</td>
                    <td>${device.lastSeen}</td>
                </tr>
            `;
        });
        deviceTableBody.innerHTML = html;
    }

    function displayMessage(message, type) {
        errorMessage.className = `alert alert-${type}`;
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});
