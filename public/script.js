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

    const WORKER_URL = 'https://YOUR_WORKER_SUBDOMAIN.YOUR_WORKER_DOMAIN.workers.dev'; // Thay thế URL này

    fetchData();

    async function fetchData() {
        deviceListDiv.innerHTML = '';
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
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
            fetchData();

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

        editDeviceModal.hide(); // Hide modal immediately

        loadingSpinner.style.display = 'block'; // Show loading spinner
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        try {
            let payload = { networkId, memberId };
            let hasChanges = false;

            // Only include name in payload if it's explicitly provided
            if (newName !== '') { // Use empty string to indicate user cleared it
                payload.newName = newName;
                hasChanges = true;
            }

            // Only include IP in payload if it's explicitly provided
            if (newIp !== '') { // Use empty string to indicate user cleared it
                const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
                if (!ipRegex.test(newIp) && newIp !== '') { // Allow empty string to clear IP
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
            fetchData(); // Re-fetch data to update UI

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
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} days ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    function displayMessage(message, type) {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
        const targetMessageElement = type === 'success' ? successMessage : errorMessage;
        targetMessageElement.textContent = message;
        targetMessageElement.style.display = 'block';

        setTimeout(() => {
            targetMessageElement.style.display = 'none';
        }, 5000);
    }
});
