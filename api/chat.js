// POST /api/chat
// Body: { personality: string, messages: [{role, content}] }
// Keeps OPENROUTER_API_KEY on the server only — never sent to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing OPENROUTER_API_KEY. Set it in your hosting provider\'s environment variables.' });
  }

  const { personality, messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages array.' });
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: [
          { role: 'system', content: personality || 'You are a helpful assistant.' },
          ...messages
        ]
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || 'OpenRouter request failed.' });
    }

    const reply = data.choices?.[0]?.message?.content?.trim() || '...';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'Could not reach OpenRouter: ' + err.message });
  }
}
