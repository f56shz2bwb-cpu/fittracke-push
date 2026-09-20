const { fittrackerStore } = require("./_blobs");

exports.handler = async () => {
  try {
    const store = fittrackerStore();
    const subscription = await store.get("subscription", { type: "json" });
    const reminders = await store.get("reminders", { type: "json" });

    const now = new Date();
    const parts = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(now);
    const map = {};
    parts.forEach((p) => (map[p.type] = p.value));
    const dateStr = `${map.year}-${map.month}-${map.day}`;

    const sentLog = await store.get(`sent-log-${dateStr}`, { type: "json" });

    let subInfo = "keine Subscription gespeichert";
    if (subscription && subscription.endpoint) {
      try {
        const host = new URL(subscription.endpoint).host;
        subInfo = `Subscription vorhanden (Endpoint-Host: ${host})`;
      } catch (e) {
        subInfo = "Subscription vorhanden, aber Endpoint ungueltig";
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          serverzeit_berlin: `${map.weekday}, ${dateStr} ${map.hour}:${map.minute}`,
          subscription_status: subInfo,
          reminders_anzahl: Array.isArray(reminders) ? reminders.length : 0,
          reminders: reminders || [],
          heute_bereits_gesendet: sentLog || {},
          netlify_site_id_gesetzt: !!process.env.NETLIFY_SITE_ID,
          fittracker_key_gesetzt: !!process.env.fittracker_key,
          vapid_public_key_gesetzt: !!process.env.VAPID_PUBLIC_KEY,
          vapid_private_key_gesetzt: !!process.env.VAPID_PRIVATE_KEY,
        },
        null,
        2
      ),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};
