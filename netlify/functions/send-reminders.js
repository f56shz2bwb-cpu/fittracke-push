const webpush = require("web-push");
const { fittrackerStore } = require("./_blobs");

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const TOLERANCE_MINUTES = 10;

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

function timeToMinutes(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function getTodaysTargets(parsed, todayName) {
  if (parsed.type === "daily") {
    return [{ key: "d", minutes: timeToMinutes(parsed.time) }];
  }
  if (parsed.type === "weekly") {
    if (parsed.day.toLowerCase() !== todayName.toLowerCase()) return [];
    return [{ key: "w", minutes: timeToMinutes(parsed.time) }];
  }
  if (parsed.type === "interval") {
    const targets = [];
    for (let h = parsed.startHour; h <= parsed.endHour; h += parsed.hours) {
      targets.push({ key: `i${h}`, minutes: h * 60 });
    }
    return targets;
  }
  return [];
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

  let store;
  try {
    store = fittrackerStore();
  } catch (err) {
    console.error("Blobs-Store Fehler:", err.message);
    return { statusCode: 500, body: err.message };
  }

  const subscription = await store.get("subscription", { type: "json" });
  const reminders = (await store.get("reminders", { type: "json" })) || [];

  if (!subscription) {
    console.log("Kein Subscription-Eintrag vorhanden - nichts zu tun");
    return { statusCode: 200, body: "Keine Subscription hinterlegt" };
  }
  if (reminders.length === 0) {
    console.log("Keine Reminders hinterlegt - nichts zu tun");
    return { statusCode: 200, body: "Keine Erinnerungen hinterlegt" };
  }

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
  const todayName = map.weekday.charAt(0).toUpperCase() + map.weekday.slice(1);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const nowMinutes = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);

  const sentLog = (await store.get(`sent-log-${dateStr}`, { type: "json" })) || {};
  let updated = false;
  const toSend = [];

  for (const r of reminders) {
    if (!r.on) continue;
    const parsed = parseReminderTime(r);
    const targets = getTodaysTargets(parsed, todayName);

    for (const t of targets) {
      const fireKey = `${r.id}_${t.key}`;
      const diff = nowMinutes - t.minutes;
      if (diff >= 0 && diff <= TOLERANCE_MINUTES && !sentLog[fireKey]) {
        toSend.push(r);
        sentLog[fireKey] = true;
        updated = true;
      }
    }
  }

  console.log(`Check um ${map.hour}:${map.minute} Uhr (${todayName}) - ${toSend.length} Erinnerung(en) faellig`);

  for (const r of toSend) {
    const payload = JSON.stringify({
      title: `${r.icon || "🔔"} ${r.name}`,
      body: "Zeit dafür — nicht vergessen!",
      tag: r.id,
    });
    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`Push gesendet: ${r.name}`);
    } catch (err) {
      console.error("Push-Fehler fuer", r.id, err.statusCode, err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await store.delete("subscription");
        console.log("Abgelaufene Subscription entfernt");
      }
    }
  }

  if (updated) {
    await store.setJSON(`sent-log-${dateStr}`, sentLog);
  }

  return { statusCode: 200, body: JSON.stringify({ sent: toSend.length, checked_at: `${map.hour}:${map.minute}` }) };
};
