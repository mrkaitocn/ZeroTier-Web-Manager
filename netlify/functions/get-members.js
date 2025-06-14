// get-members.js - Phiên bản sửa lỗi logic cache

export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');
    const { ZT_TOKEN, IPINFO_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!networkId) { return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 }); }

    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
    const jsonbinHeaders = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Cache 24 giờ

    try {
        const [stateResponse, membersResponse] = await Promise.all([
            fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } }),
            fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } })
        ]);

        if (!stateResponse.ok) throw new Error('Could not fetch state from JSONBin.');
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        
        const state = await stateResponse.json();
        let currentState = state.record;
        if (!currentState.ip_info_cache) currentState.ip_info_cache = {};
        
        const members = await membersResponse.json();
        let cacheNeedsUpdate = false;

        const finalMembers = await Promise.all(members.map(async (member) => {
            if (!member.physicalAddress || !IPINFO_TOKEN) return member;

            const ip = member.physicalAddress.split('/')[0].trim();
            const cachedData = currentState.ip_info_cache[ip];

            if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS)) {
                return { ...member, location: cachedData.data };
            }

            try {
                const locationResponse = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
                if (locationResponse.ok) {
                    const locationData = await locationResponse.json();
                    
                    // === THAY ĐỔI QUAN TRỌNG: Chỉ cache nếu có dữ liệu địa lý hợp lệ ===
                    if (locationData && locationData.city) {
                        currentState.ip_info_cache[ip] = {
                            data: locationData,
                            timestamp: Date.now()
                        };
                        cacheNeedsUpdate = true;
                    }
                    
                    return { ...member, location: locationData };
                }
            } catch (error) {
                console.error(`Failed to fetch from ipinfo.io for IP ${ip}:`, error);
            }

            return member;
        }));

        if (cacheNeedsUpdate) {
            await fetch(JSONBIN_URL, {
                method: 'PUT',
                headers: jsonbinHeaders,
                body: JSON.stringify(currentState)
            });
            console.log('IP info cache was updated in JSONBin.');
        }

        return new Response(JSON.stringify(finalMembers), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { statusCode: 500 });
    }
};
