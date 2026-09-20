// Gemeinsamer Helfer: liefert einen explizit konfigurierten Netlify-Blobs-Store,
// weil die automatische Erkennung (implizite Config) in dieser Umgebung nicht griff.
const { getStore } = require("@netlify/blobs");

function fittrackerStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.fittracker_key;

  if (!siteID || !token) {
    throw new Error(
      "NETLIFY_SITE_ID oder fittracker_key fehlt als Umgebungsvariable - Blobs-Store kann nicht erstellt werden"
    );
  }

  return getStore({ name: "fittracker", siteID, token });
}

module.exports = { fittrackerStore };
