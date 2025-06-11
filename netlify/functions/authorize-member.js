export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const { networkId, memberId, authorize, name, description } = await request.json();
    const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!networkId || !memberId || !JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        return new Response('Missing required fields or environment variables', { status: 400 });
    }

    try {
        // --- 1. Xây dựng payload động cho API của ZeroTier ---
        const ztPayload = {};
        if (typeof name !== 'undefined') ztPayload.name = name;
        if (typeof description !== 'undefined') ztPayload.description = description;
        if (typeof authorize === 'boolean') ztPayload.config = { authorized: authorize };
        if (Object.keys(ztPayload).length === 0) return new Response('No update data provided', { status: 400 });

        // --- 2. Gửi yêu cầu cập nhật lên ZeroTier ---
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(ztPayload),
        });
        if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);

        // --- 3. Dọn dẹp "sổ ghi nhớ" trong JSONBin.io ---
        // Chỉ thực hiện khi có hành động liên quan đến 'authorize'
        if (typeof authorize === 'boolean') {
            const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
            const headers = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };

            const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
            if (stateResponse.ok) {
                const state = await stateResponse.json();
                let currentState = state.record;
                let stateChanged = false;

                if (authorize) { // Nếu hành động là DUYỆT
                    if (currentState.notified_unauthorized[memberId]) {
                        delete currentState.notified_unauthorized[memberId];
                        stateChanged = true;
                        console.log(`Cleaned up ${memberId} from unauthorized notifications store.`);
                    }
                } else { // Nếu hành động là HỦY DUYỆT
                    if (currentState.online_status[memberId]) {
                        delete currentState.online_status[memberId];
                        stateChanged = true;
                        console.log(`Cleaned up ${memberId} from online status store.`);
                    }
                }

                if (stateChanged) {
                    await fetch(JSONBIN_URL, { method: 'PUT', headers: headers, body: JSON.stringify(currentState) });
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
