export default async () => {
    console.log('Function "check-new-devices" started at:', new Date().toISOString());
    const ZT_TOKEN = process.env.ZT_TOKEN;
    const PUSHOVER_USER_KEY = process.env.PUSHOVER_USER_KEY;
    const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

    if (!ZT_TOKEN || !PUSHOVER_USER_KEY || !PUSHOVER_API_TOKEN) {
        return new Response('Missing environment variables', { statusCode: 500 });
    }
    const CHECK_INTERVAL_MS = 16 * 60 * 1000;
    const consideredNewIfAfter = Date.now() - CHECK_INTERVAL_MS;

    try {
        const networksResponse = await fetch('https://api.zerotier.com/api/v1/network', { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!networksResponse.ok) throw new Error('Failed to fetch networks.');
        const networks = await networksResponse.json();
        const newUnauthorizedMembers = [];

        for (const network of networks) {
            const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${network.id}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
            if (!membersResponse.ok) continue;
            const members = await membersResponse.json();

            const newMembers = members.filter(member => !member.config.authorized && member.creationTime > consideredNewIfAfter);
            if (newMembers.length > 0) {
                newMembers.forEach(member => newUnauthorizedMembers.push({ networkName: network.config.name || network.id, ...member }));
            }
        }
        if (newUnauthorizedMembers.length > 0) {
            console.log(`Found ${newUnauthorizedMembers.length} new devices to notify.`);
            const notificationPromises = newUnauthorizedMembers.map(member => {
                const message = `Thiết bị '${member.name || member.id}' vừa tham gia mạng '${member.networkName}' và cần được phê duyệt.`;
                const pushoverBody = new URLSearchParams({ token: PUSHOVER_API_TOKEN, user: PUSHOVER_USER_KEY, message: message, title: 'ZeroTier: Thiết bị mới!', sound: 'pushover' });
                return fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: pushoverBody });
            });
            await Promise.all(notificationPromises);
        } else {
            console.log('No new devices to notify.');
        }
        return new Response('Check complete.', { statusCode: 200 });
    } catch (error) {
        console.error('An error occurred:', error);
        return new Response('Function failed.', { statusCode: 500 });
    }
};
