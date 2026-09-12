const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const reminders = JSON.parse(event.body);
    if (!Array.isArray(reminders)) {
      return { statusCode: 400, body: "Erwarte ein Array" };
    }
    const store = getStore("fittracker");
    await store.setJSON("reminders", reminders);
    return { statusCode: 200, body: JSON.stringify({ ok: true, count: reminders.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
