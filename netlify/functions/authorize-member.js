export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const { networkId, memberId, authorize } = await request.json();
    const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

    if (!networkId || !memberId || typeof authorize !== 'boolean' || !JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        return new Response('Missing required fields or environment variables', { status: 400 });
    }

    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
    const headers = { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' };

    try {
        // Luôn thực hiện hành động duyệt trước
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: { authorized: authorize } }),
        });
        if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
        
        // Sau khi duyệt thành công, cập nhật lại trạng thái trong JSONBin
        const stateResponse = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
        if (!stateResponse.ok) throw new Error('Could not fetch state from JSONBin to update.');
        const state = await stateResponse.json();
        let currentState = state.record;

        if (authorize) {
            delete currentState.notified_unauthorized[memberId];
        } else {
            delete currentState.online_status[memberId];
        }
        
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(currentState)
        });
        
        const updatedMember = await apiResponse.json();
        return new Response(JSON.stringify(updatedMember), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error in authorize-member:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};
