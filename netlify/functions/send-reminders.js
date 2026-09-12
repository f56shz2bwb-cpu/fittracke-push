const webpush = require("web-push");
const { getStore } = require("@netlify/blobs");

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function parseReminderTime(r) {
  const time = (r.time || "").trim();
  if (time.toLowerCase() === "alle 2h") {
    return { type: "interval", hours: 2, startHour: 8, endHour: 22 };
  }
  const weeklyMatch = time.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+(\d{1,2}:\d{2})$/i);
  if (weeklyMatch) {
    const t = weeklyMatch[2].length === 4 ? "0" + weeklyMatch[2] : weeklyMatch[2];
    return { type: "weekly", day: weeklyMatch[1], time: t };
  }
  const dailyMatch = time.match(/^(\d{1,2}:\d{2})$/);
  if (dailyMatch) {
    const t = dailyMatch[1].length === 4 ? "0" + dailyMatch[1] : dailyMatch[1];
    return { type: "daily", time: t };
  }
  return { type: "unknown" };
}

exports.handler = async () => {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:info@example.com";

  if (!vapidPublic || !vapidPrivate) {
    console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY fehlen als Umgebungsvariablen");
    return { statusCode: 500, body: "VAPID keys missing" };
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const store = getStore("fittracker");
  const subscription = await store.get("subscription", { type: "json" });
  const reminders = (await store.get("reminders", { type: "json" })) || [];

  if (!subscription) {
    return { statusCode: 200, body: "Keine Subscription hinterlegt" };
  }
  if (reminders.length === 0) {
    return { statusCode: 200, body: "Keine Erinnerungen hinterlegt" };
  }

  // Zeit in de-DE Zeitzone berechnen (Netlify-Server laufen in UTC)
  const now = new Date();
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  const nowHM = `${map.hour}:${map.minute}`;
  const todayName = map.weekday.charAt(0).toUpperCase() + map.weekday.slice(1);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = parseInt(map.hour, 10);

  const sentLog = (await store.get(`sent-log-${dateStr}`, { type: "json" })) || {};
  let updated = false;
  const toSend = [];

  for (const r of reminders) {
    if (!r.on) continue;
    const parsed = parseReminderTime(r);
    let fireKey = null;

    if (parsed.type === "daily" && parsed.time === nowHM) {
      fireKey = r.id;
    } else if (parsed.type === "weekly" && parsed.day.toLowerCase() === todayName.toLowerCase() && parsed.time === nowHM) {
      fireKey = r.id;
    } else if (parsed.type === "interval") {
      if (map.minute === "00" && hour >= parsed.startHour && hour <= parsed.endHour && (hour - parsed.startHour) % parsed.hours === 0) {
        fireKey = `${r.id}_${map.hour}`;
      }
    }

    if (fireKey && !sentLog[fireKey]) {
      toSend.push(r);
      sentLog[fireKey] = true;
      updated = true;
    }
  }

  for (const r of toSend) {
    const payload = JSON.stringify({
      title: `${r.icon || "🔔"} ${r.name}`,
      body: "Zeit dafür — nicht vergessen!",
      tag: r.id,
    });
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (err) {
      console.error("Push-Fehler für", r.id, err.statusCode, err.message);
      // 410/404 = Subscription ist abgelaufen -> aufräumen
      if (err.statusCode === 410 || err.statusCode === 404) {
        await store.delete("subscription");
      }
    }
  }

  if (updated) {
    await store.setJSON(`sent-log-${dateStr}`, sentLog);
  }

  return { statusCode: 200, body: JSON.stringify({ sent: toSend.length }) };
};
