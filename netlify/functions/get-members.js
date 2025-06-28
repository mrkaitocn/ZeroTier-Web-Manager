// netlify/functions/get-members.js - Phiên bản chống lỗi JSONBin

export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');
    const { ZT_TOKEN, IPINFO_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!networkId) return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 });

    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
    const jsonbinHeaders = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Cache 24 giờ

    // Khởi tạo state mặc định, phòng trường hợp JSONBin lỗi
    let currentState = { ip_info_cache: {}, notified_unauthorized: {}, online_status: {} };
    let cacheNeedsUpdate = false;

    try {
        // --- Cố gắng đọc state từ JSONBin một cách an toàn ---
        if (JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            try {
                const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
                if (stateResponse.ok) {
                    const state = await stateResponse.json();
                    // Đảm bảo state.record tồn tại và là một object
                    if (state && typeof state.record === 'object' && state.record !== null) {
                        currentState = state.record;
                    }
                } else {
                    // Nếu lỗi (ví dụ 429 - hết dung lượng), ghi lại cảnh báo và tiếp tục chạy
                    console.warn(`Could not fetch state from JSONBin. Caching is temporarily disabled. Status: ${stateResponse.status}`);
                }
            } catch(e) {
                console.error('Error connecting to JSONBin. Caching disabled.', e);
            }
        }
        if (!currentState.ip_info_cache) currentState.ip_info_cache = {}; // Đảm bảo cache object tồn tại

        const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } });
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        const members = await membersResponse.json();
        
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
                    if (locationData && locationData.city) {
                        currentState.ip_info_cache[ip] = { data: locationData, timestamp: Date.now() };
                        cacheNeedsUpdate = true;
                    }
                    return { ...member, location: locationData };
                }
            } catch (error) { console.error(`Failed to fetch from ipinfo.io for IP ${ip}:`, error); }
            return member;
        }));

        if (cacheNeedsUpdate && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            await fetch(JSONBIN_URL, { method: 'PUT', headers: jsonbinHeaders, body: JSON.stringify(currentState) });
        }

        return new Response(JSON.stringify(finalMembers), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { statusCode: 500 });
    }
};
