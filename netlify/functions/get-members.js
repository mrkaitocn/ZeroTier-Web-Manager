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
        const ztResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ztToken}` },
        });
        if (!ztResponse.ok) throw new Error(`ZeroTier API responded with ${ztResponse.status}`);
        
        let membersFromZT = await ztResponse.json();

        if (membersFromZT.length === 0) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const memberIds = membersFromZT.map(m => m.nodeId);
        const stateKeys = memberIds.map(id => `zt-member-state:${id}`);
        
        // Sửa lỗi: Phải kiểm tra stateKeys có rỗng không
        if (stateKeys.length === 0) {
            return new Response(JSON.stringify(membersFromZT), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const historyStatesRaw = await redis.mget(...stateKeys);

        const membersWithHistory = membersFromZT.map((member, index) => {
            const historyRaw = historyStatesRaw[index];
            let historyData = null;
            if (historyRaw) {
                try {
                    historyData = JSON.parse(historyRaw);
                } catch(e) {
                    historyData = { status: historyRaw, timestamp: null };
                }
            }
            return { ...member, history: historyData };
        });

        return new Response(JSON.stringify(membersWithHistory), {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Lỗi trong get-members.js:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
