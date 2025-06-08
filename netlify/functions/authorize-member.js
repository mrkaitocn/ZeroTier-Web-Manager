export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const { networkId, memberId, authorize } = await request.json();
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!networkId || !memberId || typeof authorize !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  try {
    const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ZT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config: { authorized: authorize } }),
    });

    if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
    
    const updatedMember = await apiResponse.json();
    return new Response(JSON.stringify(updatedMember), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
