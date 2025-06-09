import { getStore } from '@netlify/blobs';

export default async () => {
    console.log('Function "check-new-devices" (v3 - Dual Notification) started at:', new Date().toISOString());

    // --- Lấy các biến môi trường ---
    const ZT_TOKEN = process.env.ZT_TOKEN;
    const PUSHOVER_USER_KEY = process.env.PUSHOVER_USER_KEY;
    const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

    if (!ZT_TOKEN || !PUSHOVER_USER_KEY || !PUSHOVER_API_TOKEN) {
        console.error('Missing required environment variables.');
        return new Response('Missing environment variables', { status: 500 });
    }

    // --- Lấy 2 "sổ ghi nhớ" từ Netlify Blobs ---
    // Sổ 1: Ghi nhớ các thiết bị "chưa duyệt" đã được thông báo
    const unauthorizedStore = getStore('notified_unauthorized');
    // Sổ 2: Ghi nhớ trạng thái "lastSeen" của các thiết bị đã duyệt
    const onlineStatusStore = getStore('online_status');

    try {
        const networksResponse = await fetch('https://api.zerotier.com/api/v1/network', { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!networksResponse.ok) throw new Error('Failed to fetch networks.');
        const networks = await networksResponse.json();

        let notificationsToSend = [];

        for (const network of networks) {
            const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${network.id}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
            if (!membersResponse.ok) continue;
            const members = await membersResponse.json();

            for (const member of members) {
                const memberInfo = {
                    name: member.name || member.id,
                    networkName: network.config.name || network.id,
                    memberId: member.id
                };

                // --- LOGIC 1: Xử lý thiết bị CHƯA ĐƯỢC DUYỆT ---
                if (!member.config.authorized) {
                    const alreadyNotified = await unauthorizedStore.get(member.id);
                    if (!alreadyNotified) {
                        notificationsToSend.push({
                            message: `Thiết bị '${memberInfo.name}' trong mạng '${memberInfo.networkName}' cần được phê duyệt.`,
                            sound: 'persistent',
                            title: 'ZeroTier: Yêu Cầu Duyệt'
                        });
                        await unauthorizedStore.set(member.id, 'notified');
                    }
                }
                
                // --- LOGIC 2: Xử lý thiết bị ĐÃ ĐƯỢC DUYỆT ---
                else {
                    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
                    if (member.lastSeen > fifteenMinutesAgo) {
                        const previousStatus = await onlineStatusStore.get(member.id, { type: 'json' });
                        const previousLastSeen = previousStatus ? previousStatus.lastSeen : 0;
                        
                        if (member.lastSeen > previousLastSeen) {
                            notificationsToSend.push({
                                message: `Thiết bị '${memberInfo.name}' vừa online trong mạng '${memberInfo.networkName}'.`,
                                sound: 'pushover',
                                title: 'ZeroTier: Thiết bị Online'
                            });
                            await onlineStatusStore.setJSON(member.id, { lastSeen: member.lastSeen });
                        }
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

        return new Response('Dual notification check complete.', { status: 200 });
    } catch (error) {
        console.error('An error occurred in dual notification function:', error);
        return new Response(`Function failed: ${error.message}`, { status: 500 });
    }
};
