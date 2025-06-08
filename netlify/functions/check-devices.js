import { Redis } from '@upstash/redis';

// --- LẤY CÁC BIẾN MÔI TRƯỜNG ---
const ztToken = process.env.ZT_TOKEN;
const networkId = process.env.ZT_NETWORK_ID; // Cần thêm biến này!
const notifyMemberIds = process.env.ZT_NOTIFY_MEMBER_IDS;
const pushoverUserKey = process.env.PUSHOVER_USER_KEY;
const pushoverApiToken = process.env.PUSHOVER_API_TOKEN;

// --- KHỞI TẠO REDIS ---
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// --- HÀM GỬI THÔNG BÁO PUSHOVER ---
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
            sound: 'bike', // Âm thanh khi online
        }),
    });
}

// --- HÀM XỬ LÝ CHÍNH ĐƯỢC LÊN LỊCH ---
export const handler = async () => {
    console.log(`\n--- Bắt đầu phiên kiểm tra định kỳ lúc: ${new Date().toLocaleString('vi-VN')} ---`);

    if (!ztToken || !networkId) {
        console.error("LỖI: Thiếu ZT_TOKEN hoặc ZT_NETWORK_ID trong biến môi trường.");
        return { statusCode: 500, body: 'Missing environment variables' };
    }

    try {
        // Bước 1: Gọi API ZeroTier để lấy danh sách tất cả thành viên
        const response = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ztToken}` },
        });
        if (!response.ok) {
            throw new Error(`ZeroTier API error: ${response.status}`);
        }
        const members = await response.json();
        console.log(`Tìm thấy ${members.length} thành viên trong network.`);

        // Danh sách thiết bị cần theo dõi
        const notifyList = notifyMemberIds ? notifyMemberIds.split(',') : [];

        // Bước 2: Lặp qua từng thành viên để kiểm tra trạng thái
        for (const member of members) {
            const memberId = member.nodeId;
            const memberName = member.name || memberId;

            // Nếu có danh sách theo dõi, chỉ xử lý các thiết bị trong danh sách
            if (notifyList.length > 0 && !notifyList.includes(memberId)) {
                continue; // Bỏ qua thiết bị này
            }

            const stateKey = `zt-member-state:${memberId}`;
            const lastState = await redis.get(stateKey);

            // Một thiết bị được coi là "vừa online" nếu lastSeen trong vòng 10 phút gần đây
            // (10 phút lớn hơn chu kỳ chạy 5 phút để tránh bỏ sót)
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            const isConsideredOnline = member.lastSeen > tenMinutesAgo;

            if (isConsideredOnline && lastState !== 'online') {
                // Thiết bị vừa online!
                console.log(`PHÁT HIỆN ONLINE: ${memberName} (${memberId})`);
                await sendPushoverMessage(`✅ Online: ${memberName}`, `Thiết bị vừa kết nối vào network.`);
                await redis.set(stateKey, 'online', { ex: 2592000 }); // Lưu trạng thái online
            } else if (!isConsideredOnline && lastState === 'online') {
                // Thiết bị vừa offline!
                console.log(`PHÁT HIỆN OFFLINE: ${memberName} (${memberId})`);
                // Bạn có thể gửi thông báo offline ở đây nếu muốn
                // await sendPushoverMessage(`🔌 Offline: ${memberName}`, `Thiết bị đã ngắt kết nối.`);
                await redis.set(stateKey, 'offline', { ex: 2592000 }); // Lưu trạng thái offline
            }
        }

        console.log("--- Hoàn tất phiên kiểm tra ---");
        return { statusCode: 200, body: 'Check completed.' };

    } catch (error) {
        console.error("Đã xảy ra lỗi trong quá trình kiểm tra:", error);
        return { statusCode: 500, body: error.toString() };
    }
};
