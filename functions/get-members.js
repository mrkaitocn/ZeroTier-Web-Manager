export async function onRequest(context) {
    const url = new URL(context.request.url);
    const networkId = url.searchParams.get('networkId');
    const { ZT_TOKEN, IPINFO_TOKEN, STATE_STORE } = context.env; // STATE_STORE là tên binding chúng ta đặt ở Bước 1.2

    if (!networkId) return new Response('Network ID is required', { status: 400 });

    const CACHE_TTL_SECONDS = 24 * 60 * 60; // KV TTL tính bằng giây

    try {
        const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        const members = await membersResponse.json();
        
        const finalMembers = await Promise.all(members.map(async (member) => {
            if (!member.physicalAddress || !IPINFO_TOKEN) return member;
            
            const ip = member.physicalAddress.split('/')[0].trim();
            const cacheKey = `ipinfo:${ip}`;
            
            // Đọc cache từ Cloudflare KV
            const cachedData = await STATE_STORE.get(cacheKey, { type: 'json' });
            if (cachedData) {
                return { ...member, location: cachedData };
            }

            try {
                const locationResponse = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
                if (locationResponse.ok) {
                    const locationData = await locationResponse.json();
                    if (locationData && locationData.city) {
                        // Ghi cache vào KV với thời gian hết hạn là 24 giờ
                        await STATE_STORE.put(cacheKey, JSON.stringify(locationData), { expirationTtl: CACHE_TTL_SECONDS });
                    }
                    return { ...member, location: locationData };
                }
            } catch (error) { console.error(`Failed to fetch from ipinfo.io for IP ${ip}:`, error); }
            return member;
        }));

        return new Response(JSON.stringify(finalMembers), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
