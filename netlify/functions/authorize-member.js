// netlify/functions/authorize-member.js

export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const body = await request.json();
        const { networkId, memberId, authorize, name, ip_assignments } = body;
        const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

        if (!networkId || !memberId) {
            return new Response('Missing networkId or memberId', { status: 400 });
        }
        
        console.log('Received payload from frontend:', body);

        // Bước 1: Đọc thông tin hiện tại của thành viên để tránh ghi đè mất dữ liệu
        const currentMemberResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            headers: { 'Authorization': `token ${ZT_TOKEN}` }
        });
        if (!currentMemberResponse.ok) throw new Error('Could not fetch current member details from ZeroTier to update.');
        const ztPayload = await currentMemberResponse.json();
        
        // Bước 2: Sửa đổi dữ liệu dựa trên những gì frontend gửi lên
        let changed = false;
        if (typeof name === 'string') {
            ztPayload.name = name;
            changed = true;
        }
        if (typeof authorize === 'boolean') {
            ztPayload.config.authorized = authorize;
            changed = true;
        }
        if (Array.isArray(ip_assignments)) {
            ztPayload.config.ipAssignments = ip_assignments;
            changed = true;
        }
        
        if (!changed) return new Response('No update data provided', { status: 400 });
        
        console.log('Constructed payload to send to ZeroTier:', ztPayload);

        // Bước 3: Ghi lại toàn bộ đối tượng đã được cập nhật
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(ztPayload),
        });
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`ZeroTier API responded with ${apiResponse.status}: ${errorText}`);
        }

        // Bước 4: Dọn dẹp "sổ ghi nhớ" JSONBin nếu có hành động duyệt/hủy duyệt
        if (typeof authorize === 'boolean' && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
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
