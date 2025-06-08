import { Redis } from '@upstash/redis';

const ztToken = process.env.ZT_TOKEN;
const networkId = process.env.ZT_NETWORK_ID;
const notifyMemberIds = process.env.ZT_NOTIFY_MEMBER_IDS;
const pushoverUserKey = process.env.PUSHOVER_USER_KEY;
const pushoverApiToken = process.env.PUSHOVER_API_TOKEN;
const memberToReset = process.env.FORCE_RESET_STATE;

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function sendPushoverMessage(title, message) {
    if (!pushoverUserKey || !pushoverApiToken) return;
    console.log(`Đang gửi Pushover: ${title}`);
    await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: pushoverApiToken,
            user: pushoverUserKey,
            title: title,
            message: message,
            sound: 'bike',
        }),
    });
}

export const handler = async () => {
    console.log(`\n--- Bắt đầu phiên kiểm tra định kỳ lúc: ${new Date().toLocaleString('vi-VN')} ---`);

    if (!ztToken || !networkId) {
        console.error("LỖI: Thiếu ZT_TOKEN hoặc ZT_NETWORK_ID trong biến môi trường.");
        return { statusCode: 500, body: 'Missing environment variables' };
    }

    if (memberToReset) {
        const resetKey = `zt-member-state:${memberToReset}`;
        await redis.del(resetKey);
        console.log(`!!! Đã reset trạng thái cho thiết bị: ${memberToReset}. Vui lòng xóa biến môi trường FORCE_RESET_STATE.`);
    }

    try {
        const response = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ztToken}` },
        });
        if (!response.ok) throw new Error(`ZeroTier API error: ${response.status}`);
        
        const members = await response.json();
        const notifyList = notifyMemberIds ? notifyMemberIds.split(',') : [];

        for (const member of members) {
            const memberId = member.nodeId;
            const memberName = member.name || memberId;

            if (notifyList.length > 0 && !notifyList.includes(memberId)) {
                continue;
            }

            const stateKey = `zt-member-state:${memberId}`;
            const lastStateRaw = await redis.get(stateKey);
            
            let lastStatus = null;
            if (lastStateRaw) {
                try {
                    const lastStateData = JSON.parse(lastStateRaw);
                    lastStatus = lastStateData.status;
                } catch (e) {
                    lastStatus = lastStateRaw;
                }
            }

            const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
            const isConsideredOnline = member.lastSeen > fifteenMinutesAgo;

            if (isConsideredOnline && lastStatus !== 'online') {
                await sendPushoverMessage(`✅ Online: ${memberName}`, `Thiết bị vừa kết nối vào network.`);
                const newState = { status: 'online', timestamp: Date.now() };
                await redis.set(stateKey, JSON.stringify(newState), { ex: 2592000 });
            } else if (!isConsideredOnline && lastStatus === 'online') {
                const newState = { status: 'offline', timestamp: Date.now() };
                await redis.set(stateKey, JSON.stringify(newState), { ex: 2592000 });
            }
        }
        return { statusCode: 200, body: 'Check completed.' };

    } catch (error) {
        console.error("Đã xảy ra lỗi trong quá trình kiểm tra:", error);
        return { statusCode: 500, body: error.toString() };
    }
};
