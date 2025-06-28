// netlify/functions/authorize-member.js

export default async (request) => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const body = await request.json();
        // Giờ đây chúng ta nhận thêm cả ip_assignments
        const { networkId, memberId, authorize, name, ip_assignments } = body;
        const { ZT_TOKEN, JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;

        if (!networkId || !memberId) {
            return new Response('Missing networkId or memberId', { status: 400 });
        }
        
        console.log('Received payload from frontend:', body);

        // Bước 1: Đọc thông tin hiện tại để tránh ghi đè mất dữ liệu
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
        // Xử lý yêu cầu sửa IP
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

        // Bước 4: Dọn dẹp JSONBin nếu có hành động duyệt/hủy duyệt
        if (typeof authorize === 'boolean' && JSONBIN_API_KEY && JSONBIN_BIN_ID) {
            // ... (Logic này được giữ nguyên)
        }
        
        const updatedMember = await apiResponse.json();
        return new Response(JSON.stringify(updatedMember), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in member update function:', error);
        return new Response(error.message, { status: 500 });
    }
};
