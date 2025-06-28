export async function onRequest(context) {
    const { ZT_TOKEN, PUSHOVER_USER_KEY, PUSHOVER_API_TOKEN, STATE_STORE } = context.env;

    // ... (phần code lấy networks, members từ ZeroTier giữ nguyên) ...

    for (const member of members) {
        if (!member.config.authorized) {
            const key = `notified_unauthorized:${member.id}`;
            const alreadyNotified = await STATE_STORE.get(key);
            if (!alreadyNotified) {
                // ... thêm vào notificationsToSend
                await STATE_STORE.put(key, 'true', { expirationTtl: 60 * 60 * 24 * 7 }); // Lưu trong 7 ngày
            }
        } else {
            const key = `online_status:${member.id}`;
            const previousStatus = await STATE_STORE.get(key, { type: 'json' });
            // ... (phần logic so sánh lastSeen) ...
            if (member.lastSeen > previousLastSeen.lastSeen && ...) {
                 // ... thêm vào notificationsToSend
                await STATE_STORE.put(key, JSON.stringify({ lastSeen: member.lastSeen }));
            }
        }
    }
    
    // ... (phần gửi Pushover giữ nguyên) ...
    return new Response('Check complete (Cloudflare).');
}
