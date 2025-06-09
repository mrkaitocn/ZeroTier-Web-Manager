import { getStore } from '@netlify/blobs';

export default async (request) => {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const { networkId, memberId, authorize } = await request.json();
    const ZT_TOKEN = process.env.ZT_TOKEN;

    if (!networkId || !memberId || typeof authorize !== 'boolean') {
        return new Response('Missing required fields', { status: 400 });
    }

    try {
        const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
            method: 'POST',
            headers: { 'Authorization': `token ${ZT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: { authorized: authorize } }),
        });
        if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
        
        const unauthorizedStore = getStore('notified_unauthorized');
        const onlineStatusStore = getStore('online_status');

        if (authorize) {
            await unauthorizedStore.delete(memberId);
            console.log(`Cleaned up ${memberId} from unauthorized notifications store.`);
        } else {
            await onlineStatusStore.delete(memberId);
            console.log(`Cleaned up ${memberId} from online status store.`);
        }
        
        const updatedMember = await apiResponse.json();
        return new Response(JSON.stringify(updatedMember), {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in authorize-member:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};
