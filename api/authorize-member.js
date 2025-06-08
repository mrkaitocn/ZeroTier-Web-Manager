// api/authorize-member.js
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { networkId, memberId, authorize } = request.body;
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!networkId || !memberId || typeof authorize !== 'boolean') {
    return response.status(400).json({ error: 'Missing required fields: networkId, memberId, authorize' });
  }

  try {
    const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member/${memberId}`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ZT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: { authorized: authorize },
      }),
    });

    if (!apiResponse.ok) {
      throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
    }

    const updatedMember = await apiResponse.json();
    response.status(200).json(updatedMember);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}
