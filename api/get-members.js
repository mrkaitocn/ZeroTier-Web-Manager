// api/get-members.js
export default async function handler(request, response) {
  const { networkId } = request.query; // Lấy networkId từ query param (?networkId=...)
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!networkId) {
    return response.status(400).json({ error: 'Network ID is required' });
  }

  try {
    const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
      method: 'GET',
      headers: { 'Authorization': `token ${ZT_TOKEN}` },
    });

    if (!apiResponse.ok) {
      throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
    }

    const members = await apiResponse.json();
    response.status(200).json(members);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}
