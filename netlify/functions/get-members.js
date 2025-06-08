import { Redis } from '@upstash/redis';

const ztToken = process.env.ZT_TOKEN;
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');

    if (!networkId) {
        return new Response(JSON.stringify({ error: 'Network ID is required' }), { status: 400 });
    }

    try {
        // Bước 1: Lấy danh sách thành viên từ ZeroTier như cũ
        const ztResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ztToken}` },
        });
        if (!ztResponse.ok) throw new Error(`ZeroTier API responded with ${ztResponse.status}`);
        
        let membersFromZT = await ztResponse.json();

        if (membersFromZT.length === 0) {
            return new Response(JSON.stringify([]), { status: 200 });
        }

        // Bước 2: Lấy tất cả các key lịch sử từ Redis một lúc cho hiệu quả
        const memberIds = membersFromZT.map(m => m.nodeId);
        const stateKeys = memberIds.map(id => `zt-member-state:${id}`);
        const historyStatesRaw = await redis.mget(...stateKeys);

        // Bước 3: Ghép dữ liệu lịch sử từ Redis vào danh sách thành viên
        const membersWithHistory = membersFromZT.map((member, index) => {
            const historyRaw = historyStatesRaw[index];
            let historyData = null;
            if (historyRaw) {
                try {
                    // Thử parse JSON
                    historyData = JSON.parse(historyRaw);
                } catch(e) {
                    // Nếu không được, gán trạng thái cũ
                    historyData = { status: historyRaw, timestamp: null };
                }
            }
            // Trả về object member đã được bổ sung trường 'history'
            return { ...member, history: historyData };
        });

        return new Response(JSON.stringify(membersWithHistory), {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
