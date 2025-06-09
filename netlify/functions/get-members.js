export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');
    const ZT_TOKEN = process.env.ZT_TOKEN;
    const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

    if (!networkId) {
        return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 });
    }
    if (!IPINFO_TOKEN) {
        console.error('IPINFO_TOKEN is not configured');
        // Vẫn tiếp tục chạy nhưng không có thông tin vị trí
    }

    try {
        // 1. Lấy danh sách thành viên từ ZeroTier
        const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ZT_TOKEN}` },
        });
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        const members = await membersResponse.json();

        // 2. Nếu có token ipinfo và có thành viên, tiến hành lấy thông tin vị trí
        if (IPINFO_TOKEN && members.length > 0) {
            // Tạo một mảng các "lời hứa" (Promise) để gọi API ipinfo song song
            const locationPromises = members.map(member => {
                if (member.physicalAddress) {
                    const ip = member.physicalAddress.split('/')[0]; // Lấy IP từ chuỗi "ip/port"
                    return fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`)
                        .then(res => res.ok ? res.json() : null) // Nếu lỗi thì trả về null
                        .catch(err => {
                            console.error(`Failed to fetch location for IP ${ip}:`, err);
                            return null; // Trả về null nếu có lỗi mạng
                        });
                }
                return Promise.resolve(null); // Trả về một promise đã hoàn thành với giá trị null nếu không có IP
            });

            // Đợi tất cả các cuộc gọi API song song hoàn tất
            const locations = await Promise.all(locationPromises);

            // 3. Gộp thông tin vị trí vào thông tin thành viên ban đầu
            const membersWithLocation = members.map((member, index) => {
                return {
                    ...member,
                    location: locations[index] // Thêm thuộc tính 'location' mới
                };
            });

            return new Response(JSON.stringify(membersWithLocation), {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Nếu không có token ipinfo, trả về dữ liệu gốc
        return new Response(JSON.stringify(members), {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { statusCode: 500 });
    }
};
