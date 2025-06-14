// authorize-member.js - Phiên bản sửa lỗi "Could not fetch"

export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const { networkId, memberId, authorize, name } = await request.json();
        const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

        if (!networkId || !memberId) {
            return new Response('Missing networkId or memberId', { status: 400 });
        }

        // --- 1. Xây dựng payload trực tiếp cho API của ZeroTier ---
        const ztPayload = {};

        // Nếu frontend gửi lên 'name', thêm nó vào payload.
        // Dùng `typeof name === 'string'` để đảm bảo name không phải là null hay undefined.
        if (typeof name === 'string') {
            ztPayload.name = name;
        }

        // Nếu frontend gửi lên trạng thái 'authorize', thêm nó vào payload
        if (typeof authorize === 'boolean') {
            ztPayload.config = { authorized: authorize };
        }
        
        // Nếu không có gì để cập nhật, báo lỗi (trường hợp hiếm)
        if (Object.keys(ztPayload).length === 0) {
            return new Response('No update data provided', { status: 400 });
        }
        
        console.log('Sending payload to ZeroTier:', ztPayload);

        // --- 2. Gửi yêu cầu cập nhật lên ZeroTier ---
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(ztPayload),
        });
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`ZeroTier API responded with ${apiResponse.status}: ${errorText}`);
        }

        // --- 3. Dọn dẹp "sổ ghi nhớ" trong JSONBin.io (Logic này vẫn giữ nguyên) ---
        if (typeof authorize === 'boolean' && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            // ... (Phần code tương tác với JSONBin được giữ nguyên, không cần thay đổi)
            const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
            const headers = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };
            const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
            if (stateResponse.ok) {
                const state = await stateResponse.json();
                let currentState = state.record;
                let stateChanged = false;
                if (authorize) {
                    if (currentState.notified_unauthorized[memberId]) {
                        delete currentState.notified_unauthorized[memberId];
                        stateChanged = true;
                    }
                } else {
                    if (currentState.online_status[memberId]) {
                        delete currentState.online_status[memberId];
                        stateChanged = true;
                    }
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
