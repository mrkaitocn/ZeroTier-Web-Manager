export default async (request) => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get('networkId');
    const ZT_TOKEN = process.env.ZT_TOKEN;
    const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

    if (!networkId) {
        return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 });
    }

    try {
        const membersResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
            headers: { 'Authorization': `token ${ZT_TOKEN}` },
        });
        if (!membersResponse.ok) throw new Error(`ZeroTier API responded with ${membersResponse.status}`);
        const members = await membersResponse.json();

        if (process.env.IPINFO_TOKEN && members.length > 0) {
            const locationPromises = members.map(member => {
                if (member.physicalAddress) {
                    const ip = member.physicalAddress.split('/')[0];
                    return fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`)
                        .then(res => res.ok ? res.json() : null)
                        .catch(() => null);
                }
                return Promise.resolve(null);
            });
            const locations = await Promise.all(locationPromises);
            const membersWithLocation = members.map((member, index) => ({ ...member, location: locations[index] }));
            return new Response(JSON.stringify(membersWithLocation), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify(members), { statusCode: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { statusCode: 500 });
    }
};
