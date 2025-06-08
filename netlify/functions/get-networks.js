export default async (request) => {
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!ZT_TOKEN) {
    return new Response(JSON.stringify({ error: 'ZeroTier API token not configured' }), { status: 500 });
  }

  try {
    const apiResponse = await fetch('https://api.zerotier.com/api/v1/network', {
      headers: { 'Authorization': `token ${ZT_TOKEN}` },
    });

    if (!apiResponse.ok) throw new Error(`ZeroTier API responded with ${apiResponse.status}`);
    
    const networks = await apiResponse.json();
    return new Response(JSON.stringify(networks), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
