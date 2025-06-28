export async function onRequest(context) {
    const { ZT_TOKEN } = context.env;
    try {
        const response = await fetch('https://api.zerotier.com/api/v1/network', {
            headers: { 'Authorization': `token ${ZT_TOKEN}` }
        });
        if (!response.ok) throw new Error('Failed to fetch networks');
        const networks = await response.json();
        return new Response(JSON.stringify(networks), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
