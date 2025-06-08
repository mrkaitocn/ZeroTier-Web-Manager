import { Redis } from '@upstash/redis';

// --- LẤY CÁC BIẾN MÔI TRƯỜNG ---
const ztToken = process.env.ZT_TOKEN;
const networkId = process.env.ZT_NETWORK_ID;
const notifyMemberIds = process.env.ZT_NOTIFY_MEMBER_IDS;
const pushoverUserKey = process.env.PUSHOVER_USER_KEY;
const pushoverApiToken = process.env.PUSHOVER_API_TOKEN;
const memberToReset = process.env.FORCE_RESET_STATE;

// --- KHỞI TẠO REDIS ---
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// --- HÀM GỬI THÔNG BÁO PUSHOVER (giữ nguyên) ---
async function sendPushoverMessage(title, message) { /* ... */ }

// --- HÀM XỬ LÝ CHÍNH ĐƯỢC LÊN LỊCH ---
export const handler = async () => {
    console.log(`\n--- Bắt đầu phiên kiểm tra định kỳ lúc: ${new Date().toLocaleString('vi-VN')} ---`);

    if (!ztToken || !networkId) {
        // ... (giữ nguyên)
    }

    if (memberToReset) {
        // ... (giữ nguyên)
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
            
            // Chuyển đổi trạng thái cũ (có thể là chuỗi hoặc JSON)
            let lastStatus = null;
            if (lastStateRaw) {
                try {
                    // Thử parse JSON trước
                    const lastStateData = JSON.parse(lastStateRaw);
                    lastStatus = lastStateData.status;
                } catch (e) {
                    // Nếu không được, nó là trạng thái chuỗi kiểu cũ
                    lastStatus = lastStateRaw;
                }
            }

            const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
            const isConsideredOnline = member.lastSeen > fifteenMinutesAgo;

            if (isConsideredOnline && lastStatus !== 'online') {
                console.log(`--> PHÁT HIỆN ONLINE: ${memberName}`);
                await sendPushoverMessage(`✅ Online: ${memberName}`, `Thiết bị vừa kết nối vào network.`);
                // LƯU TRẠNG THÁI MỚI DƯỚI DẠNG OBJECT JSON
                const newState = { status: 'online', timestamp: Date.now() };
                await redis.set(stateKey, JSON.stringify(newState), { ex: 2592000 });

            } else if (!isConsideredOnline && lastStatus === 'online') {
                console.log(`--> PHÁT HIỆN OFFLINE: ${memberName}`);
                // LƯU TRẠNG THÁI MỚI DƯỚI DẠNG OBJECT JSON
                const newState = { status: 'offline', timestamp: Date.now() };
                await redis.set(stateKey, JSON.stringify(newState), { ex: 2592000 });
            }
        }

        console.log("--- Hoàn tất phiên kiểm tra ---");
        return { statusCode: 200, body: 'Check completed.' };

    } catch (error) {
        console.error("Đã xảy ra lỗi trong quá trình kiểm tra:", error);
        return { statusCode: 500, body: error.toString() };
    }
};
