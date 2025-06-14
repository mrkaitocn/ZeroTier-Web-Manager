export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');
    const { ZT_TOKEN, IPINFO_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!networkId) return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 });

    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
    const jsonbinHeaders = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Cache tồn tại trong 24 giờ

    try {
        // --- Lấy state từ JSONBin và thành viên từ ZeroTier ---
        const [stateResponse, membersResponse] = await Promise.all([
            fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } }),
            fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, { headers: { 'Authorization': `token ${ZT_TOKEN}` } })
        ]);

        if (!stateResponse.ok) throw new Error('Could not fetch state from JSONBin.');
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        
        const state = await stateResponse.json();
        let currentState = state.record;
        // Đảm bảo cache object tồn tại
        if (!currentState.ip_info_cache) currentState.ip_info_cache = {};
        
        const members = await membersResponse.json();
        let cacheNeedsUpdate = false;

        // --- Xử lý thông tin vị trí với logic Caching ---
        const finalMembers = await Promise.all(members.map(async (member) => {
            if (!member.physicalAddress || !IPINFO_TOKEN) return member;

            const ip = member.physicalAddress.split('/')[0];
            const cachedData = currentState.ip_info_cache[ip];

            // 1. Kiểm tra Cache Hit: Dữ liệu có trong cache và chưa hết hạn
            if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS)) {
                return { ...member, location: cachedData.data };
            }

            // 2. Cache Miss: Gọi API thật
            try {
                const locationResponse = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
                if (locationResponse.ok) {
                    const locationData = await locationResponse.json();
                    
                    // 3. Cập nhật cache với dữ liệu mới và timestamp
                    currentState.ip_info_cache[ip] = {
                        data: locationData,
                        timestamp: Date.now()
                    };
                    cacheNeedsUpdate = true; // Đánh dấu cần lưu lại state
                    
                    return { ...member, location: locationData };
                }
            } catch (error) {
                console.error(`Failed to fetch from ipinfo.io for IP ${ip}:`, error);
            }

            // Nếu API lỗi hoặc không tìm thấy, trả về thành viên không có location
            return member;
        }));

        // 4. Nếu cache đã thay đổi, cập nhật lại toàn bộ state lên JSONBin
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
