export default async () => {
    console.log('Function "check-new-devices" (v4 - JSONBin) started at:', new Date().toISOString());

    const { ZT_TOKEN, PUSHOVER_USER_KEY, PUSHOVER_API_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!ZT_TOKEN || !PUSHOVER_USER_KEY || !PUSHOVER_API_TOKEN || !JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        console.error('Missing one or more required environment variables.');
        return new Response('Missing environment variables', { status: 500 });
    }

    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
    const headers = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };

    try {
        // 1. Đọc trạng thái hiện tại từ JSONBin
        const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
        if (!stateResponse.ok) throw new Error('Could not fetch state from JSONBin.');
        const state = await stateResponse.json();
        // Lấy record vì JSONBin trả về trong một object record
        let currentState = state.record; 
        
        let stateChanged = false;
        
        // ... (phần code lấy networks và members giữ nguyên)
        const networksResponse = await fetch('https://api.zerotier.com/api/v1/network', { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!networksResponse.ok) throw new Error('Failed to fetch networks.');
        const networks = await networksResponse.json();
        let notificationsToSend = [];

        for (const network of networks) {
            const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${network.id}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
            if (!membersResponse.ok) continue;
            const members = await membersResponse.json();

            for (const member of members) {
                const memberInfo = { name: member.name || member.id, networkName: network.config.name || network.id };

                if (!member.config.authorized) {
                    if (!currentState.notified_unauthorized[member.id]) {
                        notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' trong mạng '${memberInfo.networkName}' cần được phê duyệt.`, sound: 'persistent', title: 'ZeroTier: Yêu Cầu Duyệt' });
                        currentState.notified_unauthorized[member.id] = 'notified';
                        stateChanged = true;
                    }
                } else {
                    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
                    if (member.lastSeen > fifteenMinutesAgo) {
                        const previousLastSeen = currentState.online_status[member.id] ? currentState.online_status[member.id].lastSeen : 0;
                        if (member.lastSeen > previousLastSeen) {
                            notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' vừa online trong mạng '${memberInfo.networkName}'.`, sound: 'pushover', title: 'ZeroTier: Thiết bị Online' });
                            currentState.online_status[member.id] = { lastSeen: member.lastSeen };
                            stateChanged = true;
                        }
                    }
                }
            }
        }

        // 2. Gửi thông báo nếu có
        if (notificationsToSend.length > 0) {
            console.log(`Sending ${notificationsToSend.length} notification(s)...`);
            const notificationPromises = notificationsToSend.map(notif => {
                const pushoverBody = new URLSearchParams({ token: PUSHOVER_API_TOKEN, user: PUSHOVER_USER_KEY, message: notif.message, title: notif.title, sound: notif.sound });
                return fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: pushoverBody });
            });
            await Promise.all(notificationPromises);
        } else {
            console.log('No new events to notify.');
        }

        // 3. Nếu trạng thái đã thay đổi, ghi lại vào JSONBin
        if (stateChanged) {
            await fetch(JSONBIN_URL, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(currentState)
            });
            console.log('State updated in JSONBin.');
        }

        return new Response('Check complete (JSONBin).', { status: 200 });
    } catch (error) {
        console.error('An error occurred:', error);
        return new Response(`Function failed: ${error.message}`, { status: 500 });
    }
};
