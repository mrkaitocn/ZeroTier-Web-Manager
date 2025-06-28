document.addEventListener('DOMContentLoaded', () => {
    const deviceListDiv = document.getElementById('deviceList');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const displayNetworkId = document.getElementById('displayNetworkId');

    const editDeviceModal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
    const editDeviceNetworkIdInput = document.getElementById('editDeviceNetworkId');
    const editDeviceIdInput = document.getElementById('editDeviceId');
    const editDeviceNameInput = document.getElementById('editDeviceName');
    const editDeviceIpInput = document.getElementById('editDeviceIp');
    const saveDeviceChangesBtn = document.getElementById('saveDeviceChangesBtn');

    const WORKER_URL = 'https://zerotier-backend.mrkaitocn.workers.dev/'; // Thay thế URL này

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

            const data = await response.json();
            const networkId = data.networkId;
            const devices = data.devices;

            displayNetworkId.textContent = networkId;

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
                        <h5>${device.name} <small class="text-muted">(ID: ${device.zerotierId.substring(0, 8)}...)</small></h5>
                        <p><strong>ZeroTier IP:</strong> ${device.zerotierIp}</p>
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
                            <button type="button" class="btn btn-info btn-sm edit-btn"
                                data-bs-toggle="modal" data-bs-target="#editDeviceModal"
                                data-network-id="${device.networkId}"
                                data-member-id="${device.zerotierId}"
                                data-name="${device.name}"
                                data-ip="${device.zerotierIp}">
                                Edit
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
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', openEditModal);
        });
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

    function openEditModal(event) {
        const button = event.target;
        editDeviceNetworkIdInput.value = button.dataset.networkId;
        editDeviceIdInput.value = button.dataset.memberId;
        editDeviceNameInput.value = button.dataset.name;
        editDeviceIpInput.value = button.dataset.ip !== 'N/A' ? button.dataset.ip : '';
    }

    saveDeviceChangesBtn.addEventListener('click', async () => {
        const networkId = editDeviceNetworkIdInput.value;
        const memberId = editDeviceIdInput.value;
        const newName = editDeviceNameInput.value.trim();
        const newIp = editDeviceIpInput.value.trim();

        editDeviceModal.hide(); // Ẩn modal ngay lập tức

        loadingSpinner.style.display = 'block'; // Hiển thị spinner
        hideMessages();

        try {
            let payload = { networkId, memberId };
            let hasChanges = false;

            // Kiểm tra và thêm newName vào payload nếu có sự thay đổi hoặc muốn xóa tên
            // So sánh với giá trị hiện tại trong modal, không phải giá trị ban đầu của device
            if (newName !== document.getElementById('editDeviceName').defaultValue.trim()) {
                payload.newName = newName;
                hasChanges = true;
            }

            // Kiểm tra và thêm newIp vào payload nếu có sự thay đổi hoặc muốn xóa IP
            if (newIp !== document.getElementById('editDeviceIp').defaultValue.trim() && newIp !== 'N/A') {
                const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
                if (newIp !== '' && !ipRegex.test(newIp)) { // Cho phép để trống để xóa IP
                    throw new Error('Invalid IP address format. Please enter a valid IPv4 address or leave empty to clear.');
                }
                payload.newIp = newIp;
                hasChanges = true;
            }


            if (!hasChanges) {
                displayMessage('No changes to save.', 'info');
                return;
            }

            const response = await fetch(WORKER_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            displayMessage(result.message, 'success');
            fetchData(); // Tải lại dữ liệu để cập nhật UI

        } catch (error) {
            console.error('Error saving device changes:', error);
            displayMessage(`Failed to save device changes: ${error.message}`, 'danger');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });


    function formatLastSeen(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        const now = new Date();
        const diffSeconds = Math.floor((now - date) / 1000);

        if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hours ago`;
        const diffDays = Math.floor(diffHours / 30); // Use 30 days for a month approximation
        if (diffDays < 12) return `${diffDays} months ago`; // Approx. months
        const diffYears = Math.floor(diffDays / 12); // Approx. years
        return `${diffYears} years ago`;
    }
});
