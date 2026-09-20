exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY fehlt als Umgebungsvariable" }) };
  }

  try {
    const { base64, mediaType } = JSON.parse(event.body);
    if (!base64 || !mediaType) {
      return { statusCode: 400, body: JSON.stringify({ error: "base64 oder mediaType fehlt" }) };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: 'Analysiere dieses Essen. Antworte NUR mit JSON (kein Markdown): {"dish":"Name","portion":"geschätzte Portion","kcal":Zahl,"prot":Zahl,"carbs":Zahl,"fat":Zahl,"confidence":"hoch/mittel/niedrig"}',
              },
            ],
          },
        ],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Anthropic API Fehler:", data);
      return { statusCode: resp.status, body: JSON.stringify({ error: data.error?.message || "Anthropic API Fehler" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
