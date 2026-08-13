// POST /api/tts
// Body: { text: string, fishApiKey: string, voiceId: string }
// The Fish Audio key here is the *user's own key*, typed into the app per bot —
// it is forwarded to Fish Audio for this one request only, never stored server-side.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, fishApiKey, voiceId } = req.body || {};
  if (!text || !fishApiKey || !voiceId) {
    return res.status(400).json({ error: 'Missing text, fishApiKey, or voiceId.' });
  }

  try {
    const upstream = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fishApiKey}`,
        'Content-Type': 'application/json',
        'model': 's1'
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3'
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: errText || 'Fish Audio request failed.' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(arrayBuffer));

  } catch (err) {
    return res.status(500).json({ error: 'Could not reach Fish Audio: ' + err.message });
  }
}
