// authorize-member.js - Phiên bản hỗ trợ sửa IP ảo an toàn

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

        // --- BƯỚC 1: ĐỌC THÔNG TIN HIỆN TẠI (READ) ---
        const currentMemberResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            headers: { 'Authorization': `token ${ZT_TOKEN}` }
        });
        if (!currentMemberResponse.ok) throw new Error('Could not fetch current member details from ZeroTier to update.');
        const ztPayload = await currentMemberResponse.json();
        
        // --- BƯỚC 2: SỬA ĐỔI DỮ LIỆU (MODIFY) ---
        // Cập nhật payload với dữ liệu mới từ frontend
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
        
        console.log('Constructed payload for ZeroTier API:', ztPayload);

        // --- BƯỚC 3: GHI LẠI DỮ LIỆU (WRITE) ---
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(ztPayload),
        });
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`ZeroTier API responded with ${apiResponse.status}: ${errorText}`);
        }

        // --- Dọn dẹp JSONBin nếu có hành động duyệt ---
        if (typeof authorize === 'boolean' && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            // ... (Phần code này giữ nguyên)
        }
        
        const updatedMember = await apiResponse.json();
        return new Response(JSON.stringify(updatedMember), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in member update function:', error);
        return new Response(error.message, { status: 500 });
    }
};
