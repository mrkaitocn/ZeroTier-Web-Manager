document.addEventListener('DOMContentLoaded', () => {
    const networkSelect = document.getElementById('network-select');
    const memberList = document.getElementById('member-list');
    const memberHeader = document.getElementById('member-header');
    const loading = document.getElementById('loading-indicator');

    // Show/hide loading indicator
    const showLoading = (isLoading) => {
        loading.style.display = isLoading ? 'block' : 'none';
    };

    // Fetch and display networks
    const loadNetworks = async () => {
        showLoading(true);
        try {
            const response = await fetch('/api/get-networks');
            const networks = await response.json();

            networkSelect.innerHTML = '<option selected disabled>Choose a network...</option>';
            networks.forEach(net => {
                const option = document.createElement('option');
                option.value = net.id;
                option.textContent = `${net.config.name} (${net.id})`;
                networkSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading networks:', error);
            alert('Failed to load networks.');
        }
        showLoading(false);
    };

    // Fetch and display members for a selected network
    const loadMembers = async (networkId) => {
        showLoading(true);
        memberList.innerHTML = '';
        memberHeader.style.display = 'block';

        try {
            const response = await fetch(`/api/get-members?networkId=${networkId}`);
            const members = await response.json();

            if (members.length === 0) {
                memberList.innerHTML = '<li class="list-group-item">No members found in this network.</li>';
            }

            members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';

                const name = member.name || 'N/A';
                const ip = member.config.ipAssignments ? member.config.ipAssignments.join(', ') : 'No IP';
                
                li.innerHTML = `
                    <div>
                        <strong>${name}</strong> (${member.nodeId})<br>
                        <small>IP: ${ip}</small>
                    </div>
                    <button class="btn ${member.config.authorized ? 'btn-danger' : 'btn-success'}" 
                            data-member-id="${member.nodeId}" 
                            data-authorized="${member.config.authorized}">
                        ${member.config.authorized ? 'Deauthorize' : 'Authorize'}
                    </button>
                `;
                memberList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading members:', error);
            alert('Failed to load members.');
        }
        showLoading(false);
    };

    // Authorize or deauthorize a member
    const toggleAuthorization = async (networkId, memberId, shouldAuthorize) => {
        showLoading(true);
        try {
            const response = await fetch('/api/authorize-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    networkId: networkId,
                    memberId: memberId,
                    authorize: shouldAuthorize,
                }),
            });

            if (!response.ok) throw new Error('Failed to update member status.');

            // Refresh the member list to show the change
            await loadMembers(networkId);

        } catch (error) {
            console.error('Error updating member:', error);
            alert('Failed to update member.');
            showLoading(false);
        }
    };

    // Event Listeners
    networkSelect.addEventListener('change', () => {
        const networkId = networkSelect.value;
        if (networkId) {
            loadMembers(networkId);
        }
    });

    memberList.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const button = event.target;
            const memberId = button.dataset.memberId;
            const isAuthorized = button.dataset.authorized === 'true';
            const networkId = networkSelect.value;
            
            // The action is the opposite of the current state
            toggleAuthorization(networkId, memberId, !isAuthorized);
        }
    });

    // Initial load
    loadNetworks();
});
