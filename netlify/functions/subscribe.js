const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const subscription = JSON.parse(event.body);
    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: "Ungültige Subscription" };
    }
    const store = getStore("fittracker");
    await store.setJSON("subscription", subscription);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
