export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const body = await request.json();
        const { networkId, memberId, authorize, name } = body;
        const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

        if (!networkId || !memberId) {
            return new Response('Missing networkId or memberId', { status: 400 });
        }
        
        console.log('Received payload from frontend:', body);

        // --- Xây dựng payload động cho API của ZeroTier ---
        const ztPayload = {};
        
        // Luôn lấy thông tin hiện tại để không ghi đè các trường khác
        const currentMemberResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            headers: { 'Authorization': `token ${ZT_TOKEN}` }
        });
        if (!currentMemberResponse.ok) throw new Error('Could not fetch current member details from ZeroTier.');
        const currentMember = await currentMemberResponse.json();
        
        // Gán các giá trị hiện tại vào payload
        ztPayload.name = currentMember.name;
        ztPayload.description = currentMember.description;
        ztPayload.config = currentMember.config;

        // Cập nhật payload với dữ liệu mới từ frontend
        if (typeof name !== 'undefined') {
            ztPayload.name = name;
        }
        if (typeof authorize === 'boolean') {
            // Đảm bảo không làm mất các cài đặt config khác
            ztPayload.config = { ...ztPayload.config, authorized: authorize };
        }
        
        console.log('Constructed payload for ZeroTier API:', ztPayload);

        // --- Gửi yêu cầu cập nhật lên ZeroTier ---
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(ztPayload),
        });
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`ZeroTier API responded with ${apiResponse.status}: ${errorText}`);
        }

        // --- Dọn dẹp "sổ ghi nhớ" trong JSONBin.io (nếu có hành động duyệt) ---
        if (typeof authorize === 'boolean' && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
            const headers = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };

            const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
            if (stateResponse.ok) {
                const state = await stateResponse.json();
                let currentState = state.record;
                let stateChanged = false;
                if (authorize && currentState.notified_unauthorized[memberId]) {
                    delete currentState.notified_unauthorized[memberId];
                    stateChanged = true;
                } else if (!authorize && currentState.online_status[memberId]) {
                    delete currentState.online_status[memberId];
                    stateChanged = true;
                }
                if (stateChanged) {
                    await fetch(JSONBIN_URL, { method: 'PUT', headers: headers, body: JSON.stringify(currentState) });
                    console.log(`JSONBin state updated for member ${memberId}.`);
                }
            }
        }
        
        const updatedMember = await apiResponse.json();
        return new Response(JSON.stringify(updatedMember), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in member update function:', error);
        return new Response(error.message, { status: 500 });
    }
};
