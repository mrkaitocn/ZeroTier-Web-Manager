// api/get-networks.js
export default async function handler(request, response) {
  const ZT_TOKEN = process.env.ZT_TOKEN; // Lấy token từ biến môi trường

  if (!ZT_TOKEN) {
    return response.status(500).json({ error: 'ZeroTier API token not configured' });
  }

  try {
    const apiResponse = await fetch('https://api.zerotier.com/api/v1/network', {
      method: 'GET',
      headers: {
        'Authorization': `token ${ZT_TOKEN}`,
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
    }

    const networks = await apiResponse.json();
    response.status(200).json(networks);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}
