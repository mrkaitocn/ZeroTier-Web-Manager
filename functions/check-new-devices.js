// functions/check-new-devices.js - Phiên bản cho Cloudflare Cron Trigger

// Logic chính của hàm, được tách ra để dễ đọc
async function performCheck(env) {
    console.log('Scheduled function "check-new-devices" (Cloudflare) started at:', new Date().toISOString());

    const { ZT_TOKEN, PUSHOVER_USER_KEY, PUSHOVER_API_TOKEN, STATE_STORE } = env;

    if (!ZT_TOKEN || !PUSHOVER_USER_KEY || !PUSHOVER_API_TOKEN || !STATE_STORE) {
        console.error('Missing required environment variables or KV binding.');
        return;
    }
    
    // Khởi tạo các key để dùng trong Cloudflare KV
    const UNAUTHORIZED_KEY = 'notified_unauthorized';
    const ONLINE_STATUS_KEY = 'online_status';
    const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000; // 1 giờ

    try {
        // Đọc trạng thái từ Cloudflare KV
        const notified_unauthorized = await STATE_STORE.get(UNAUTHORIZED_KEY, { type: 'json' }) || {};
        const online_status = await STATE_STORE.get(ONLINE_STATUS_KEY, { type: 'json' }) || {};

        const networksResponse = await fetch('https://api.zerotier.com/api/v1/network', { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!networksResponse.ok) throw new Error('Failed to fetch networks.');
        const networks = await networksResponse.json();

        let notificationsToSend = [];
        let unauthorizedStateChanged = false;
        let onlineStateChanged = false;

        for (const network of networks) {
            const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${network.id}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
            if (!membersResponse.ok) continue;
            const members = await membersResponse.json();

            for (const member of members) {
                const memberInfo = { name: member.name || member.nodeId, networkName: network.config.name || network.id };

                if (!member.config.authorized) {
                    if (!notified_unauthorized[member.nodeId]) {
                        notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' trong mạng '${memberInfo.networkName}' cần được phê duyệt.`, sound: 'persistent', title: 'ZeroTier: Yêu Cầu Duyệt' });
                        notified_unauthorized[member.nodeId] = 'notified';
                        unauthorizedStateChanged = true;
                    }
                } else {
                    const previousLastSeen = online_status[member.nodeId] ? online_status[member.nodeId].lastSeen : 0;
                    if (member.lastSeen > previousLastSeen && (member.lastSeen - previousLastSeen > OFFLINE_THRESHOLD_MS)) {
                        notificationsToSend.push({ message: `Thiết bị '${memberInfo.name}' vừa online trở lại trong mạng '${memberInfo.networkName}'.`, sound: 'pushover', title: 'ZeroTier: Thiết bị Online' });
                        online_status[member.nodeId] = { lastSeen: member.lastSeen };
                        onlineStateChanged = true;
                    }
                }
            }
        }

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

        // Chỉ ghi lại vào KV nếu có sự thay đổi
        if (unauthorizedStateChanged) {
            await STATE_STORE.put(UNAUTHORIZED_KEY, JSON.stringify(notified_unauthorized));
        }
        if (onlineStateChanged) {
            await STATE_STORE.put(ONLINE_STATUS_KEY, JSON.stringify(online_status));
        }

    } catch (error) {
        console.error('An error occurred in scheduled function:', error);
    }
}

// Cấu trúc export đặc biệt cho Cloudflare Workers
export default {
    // Hàm scheduled sẽ được gọi bởi Cron Trigger
    async scheduled(event, env, ctx) {
        // Dùng ctx.waitUntil để đảm bảo hàm chạy xong ngay cả khi request đã đóng
        ctx.waitUntil(performCheck(env));
    },
    // Chúng ta vẫn giữ lại hàm fetch để có thể gọi nó thủ công qua URL để test
    async fetch(request, env, ctx) {
        await performCheck(env);
        return new Response("Scheduled function executed manually.");
    }
};
