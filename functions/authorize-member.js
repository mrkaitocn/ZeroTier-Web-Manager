export async function onRequest(context) {
    if (context.request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    
    try {
        const body = await context.request.json();
        const { networkId, memberId, authorize, name, ip_assignments } = body;
        const { ZT_TOKEN, STATE_STORE } = context.env;
        
        // ... (phần code đọc thông tin hiện tại và gửi yêu cầu cập nhật lên ZeroTier giữ nguyên) ...

        if (typeof authorize === 'boolean') {
            const key = authorize ? `notified_unauthorized:${memberId}` : `online_status:${memberId}`;
            // Thay vì đọc-sửa-ghi, chúng ta chỉ cần xóa key không cần thiết nữa
            await STATE_STORE.delete(key);
        }
        
        // ... (phần trả về response thành công giữ nguyên) ...
        return new Response(JSON.stringify(updatedMember), { headers: {'Content-Type': 'application/json'} });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
