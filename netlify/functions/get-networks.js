// Cú pháp chuẩn cho Netlify Functions
export default async () => {
  const ZT_TOKEN = process.env.ZT_TOKEN;

  if (!ZT_TOKEN) {
    return new Response(JSON.stringify({ error: 'ZeroTier API token not configured on Netlify' }), {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiResponse = await fetch('https://api.zerotier.com/api/v1/network', {
      headers: { 'Authorization': `token ${ZT_TOKEN}` },
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`ZeroTier API responded with ${apiResponse.status}: ${errorText}`);
    }
    
    const networks = await apiResponse.json();
    return new Response(JSON.stringify(networks), {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
