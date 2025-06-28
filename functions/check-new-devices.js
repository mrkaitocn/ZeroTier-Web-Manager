// netlify/functions/check-new-devices.js - Phiên bản chống lỗi JSONBin

export default async () => {
    console.log('Function "check-new-devices" (v4-resilient) started at:', new Date().toISOString());

    const { ZT_TOKEN, PUSHOVER_USER_KEY, PUSHOVER_API_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!ZT_TOKEN || !PUSHOVER_USER_KEY || !PUSHOVER_API_TOKEN) {
        console.error('Core environment variables are missing.');
        return new Response('Missing core environment variables', { status: 500 });
    }

    // --- Cố gắng đọc state từ JSONBin một cách an toàn ---
    let currentState = null;
    let stateLoadedSuccessfully = false;

    if (JSONBIN_API_KEY && JSONBIN_BIN_ID) {
        try {
            const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
            const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
            if (stateResponse.ok) {
                const state = await stateResponse.json();
                if (state && typeof state.record === 'object' && state.record !== null) {
                    currentState = state.record;
                    stateLoadedSuccessfully = true;
                    console.log('Successfully loaded state from JSONBin.');
                }
            } else {
                console.warn(`Could not fetch state from JSONBin. Status: ${stateResponse.status}`);
            }
        } catch(e) {
            console.error('Error connecting to JSONBin.', e);
        }
    }

    // Nếu không thể tải state, khởi tạo một object rỗng để code không bị crash
    if (!stateLoadedSuccessfully) {
        currentState = { notified_unauthorized: {}, online_status: {} };
    }

    try {
        const networksResponse = await fetch('https://api.zerotier.com/api/v1/network', { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!networksResponse.ok) throw new Error('Failed to fetch networks.');
        const networks = await networksResponse.json();

        let notificationsToSend = [];
        let stateChanged = false;

        for (const network of networks) {
            const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${network.id}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
            if (!membersResponse.ok) continue;
            const members = await membersResponse.json();

            for (const member of members) {
                const memberInfo = { name: member.name || member.id, networkName: network.config.name || network.id };

                // --- LOGIC 1: Luôn chạy cho thiết bị CHƯA ĐƯỢC DUYỆT ---
                if (!member.config.authorized) {
                    if (!currentState.notified_unauthorized[member.id]) {
                        notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' trong mạng '${memberInfo.networkName}' cần được phê duyệt.`, sound: 'persistent', title: 'ZeroTier: Yêu Cầu Duyệt' });
                        currentState.notified_unauthorized[member.id] = 'notified';
                        stateChanged = true;
                    }
                } 
                // --- LOGIC 2: Chỉ chạy cho thiết bị ĐÃ ĐƯỢC DUYỆT nếu state được tải thành công ---
                else if (stateLoadedSuccessfully) {
                    const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000;
                    const previousLastSeen = currentState.online_status[member.id] ? currentState.online_status[member.id].lastSeen : 0;
                    if (member.lastSeen > previousLastSeen && (member.lastSeen - previousLastSeen > OFFLINE_THRESHOLD_MS)) {
                        notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' vừa online trở lại trong mạng '${memberInfo.networkName}'.`, sound: 'pushover', title: 'ZeroTier: Thiết bị Online' });
                        currentState.online_status[member.id] = { lastSeen: member.lastSeen };
                        stateChanged = true;
                    }
                }
            }
        }

        // --- Gửi thông báo và cập nhật state (nếu có thể) ---
        if (notificationsToSend.length > 0) {
            // Gửi Pushover... (logic giữ nguyên)
        }
        
        if (stateChanged && stateLoadedSuccessfully) {
            // Cập nhật lại JSONBin... (logic giữ nguyên)
        }

        return new Response('Resilient notification check complete.', { status: 200 });
    } catch (error) {
        console.error('An error occurred during main execution:', error);
        return new Response(`Function failed: ${error.message}`, { status: 500 });
    }
};
