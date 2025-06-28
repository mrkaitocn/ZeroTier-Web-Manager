document.addEventListener('DOMContentLoaded', () => {
    const deviceListDiv = document.getElementById('deviceList');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const displayNetworkId = document.getElementById('displayNetworkId');

    // Các biến liên quan đến Edit Modal đã bị loại bỏ
    // const editDeviceModal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
    // const editDeviceNetworkIdInput = document.getElementById('editDeviceNetworkId');
    // const editDeviceIdInput = document.getElementById('editDeviceId');
    // const editDeviceNameInput = document.getElementById('editDeviceName');
    // const editDeviceIpInput = document.getElementById('editDeviceIp');
    // const saveDeviceChangesBtn = document.getElementById('saveDeviceChangesBtn');

    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev/'; // THAY THẾ BẰNG URL WORKER THỰC TẾ CỦA BẠN!

    // Hàm để ẩn thông báo sau một thời gian
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // Hàm hiển thị thông báo
    function displayMessage(message, type) {
        hideMessages(); // Ẩn thông báo cũ trước
        const targetMessageElement = type === 'success' ? successMessage : errorMessage;
        targetMessageElement.textContent = message;
        targetMessageElement.style.display = 'block';

        setTimeout(() => {
            hideMessages();
        }, 5000); // Ẩn sau 5 giây
    }

    // Tự động gọi fetchData khi trang được tải
    fetchData();

    async function fetchData() {
        deviceListDiv.innerHTML = '';
        hideMessages();
        loadingSpinner.style.display = 'block';
        displayNetworkId.textContent = 'Loading...';

        try {
            const response = await fetch(WORKER_URL);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const data = await response.json(); // Nhận object chứa networkId và devices
            const networkId = data.networkId;
            const devices = data.devices;

            displayNetworkId.textContent = networkId; // Hiển thị Network ID

            renderDeviceCards(devices);

        } catch (error) {
            console.error('Error fetching data:', error);
            displayMessage(`Failed to fetch device data: ${error.message}`, 'danger');
            deviceListDiv.innerHTML = '<div class="col-12 text-center text-muted">Error loading data.</div>';
            displayNetworkId.textContent = 'Error';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderDeviceCards(devices) {
        if (devices.length === 0) {
            deviceListDiv.innerHTML = '<div class="col-12 text-center text-muted">No devices found in this network.</div>';
            return;
        }

        let html = '';
        devices.forEach(device => {
            const lastSeen = formatLastSeen(device.lastOnlineTimestamp);
            const statusClass = device.authorized ? 'authorized' : 'unauthorized';
            const authorizeBtnText = device.authorized ? 'Deauthorize' : 'Authorize';
            const authorizeBtnClass = device.authorized ? 'btn-danger' : 'btn-success';

            html += `
                <div class="col-md-6">
                    <div class="device-card ${statusClass}">
                        <h5>${device.name}</h5>
                        <p><strong>ZeroTier ID:</strong> ${device.zerotierId}</p> <p><strong>ZeroTier IP:</strong> ${device.zerotierIp}</p>
                        <p><strong>Physical IP:</strong> ${device.physicalIp}</p>
                        <p><strong>Location:</strong> ${device.location}</p>
                        <p><strong>ASN:</strong> ${device.asn}</p>
                        <p><strong>Last Seen:</strong> ${lastSeen}</p>
                        <div class="btn-group w-100" role="group">
                            <button type="button" class="btn ${authorizeBtnClass} btn-sm authorize-btn"
                                data-network-id="${device.networkId}"
                                data-member-id="${device.zerotierId}"
                                data-authorized="${device.authorized ? 'true' : 'false'}">
                                ${authorizeBtnText}
                            </button>
                            </div>
                    </div>
                </div>
            `;
        });
        deviceListDiv.innerHTML = html;

        // Gắn lại các sự kiện sau khi render xong
        document.querySelectorAll('.authorize-btn').forEach(button => {
            button.addEventListener('click', handleAuthorizeToggle);
        });
        // Event listener cho nút Edit đã bị loại bỏ
    }

    async function handleAuthorizeToggle(event) {
        const button = event.target;
        const networkId = button.dataset.networkId;
        const memberId = button.dataset.memberId;
        const currentAuthorized = button.dataset.authorized === 'true';
        const action = currentAuthorized ? 'deauthorize' : 'authorize';

        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            const response = await fetch(WORKER_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ networkId, memberId, action })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            displayMessage(result.message, 'success');
            fetchData(); // Re-fetch data to update UI

        } catch (error) {
            console.error('Error toggling authorization:', error);
            displayMessage(`Failed to update authorization: ${error.message}`, 'danger');
        } finally {
            button.disabled = false;
        }
    }

    // Hàm mở Edit Modal đã bị loại bỏ
    // function openEditModal(event) { ... }

    // Event listener cho nút Save Changes đã bị loại bỏ
    // saveDeviceChangesBtn.addEventListener('click', async () => { ... });


    // Fix cho Last Seen formatting
    function formatLastSeen(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMillis = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMillis / 1000);

        if (diffSeconds < 0) return 'In the future?'; // Should not happen
        if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hours ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} days ago`; // Up to ~1 month

        const diffMonths = Math.floor(diffDays / 30.44); // Average days in a month
        if (diffMonths < 12) return `${diffMonths} months ago`;

        const diffYears = Math.floor(diffMonths / 12);
        return `${diffYears} years ago`;
    }
});
