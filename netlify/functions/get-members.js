export default async (request) => {
  const url = new URL(request.url);
  const networkId = url.searchParams.get('networkId');
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!networkId) {
    return new Response(JSON.stringify({ error: 'Network ID is required' }), { statusCode: 400 });
  }

  try {
    const apiResponse = await fetch(`https://api.zerotier.com/api/v1/network/${networkId}/member`, {
      headers: { 'Authorization': `token ${ZT_TOKEN}` },
    });

    if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);

    const members = await apiResponse.json();
    return new Response(JSON.stringify(members), {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { statusCode: 500 });
  }
};
