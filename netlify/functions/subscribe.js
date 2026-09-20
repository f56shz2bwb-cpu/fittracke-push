const { fittrackerStore } = require("./_blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const subscription = JSON.parse(event.body);
    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: "Ungueltige Subscription" };
    }
    const store = fittrackerStore();
    await store.setJSON("subscription", subscription);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
