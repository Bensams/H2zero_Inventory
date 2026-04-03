/**
 * Injects API_BASE_URL into Frontend/assets/js/config.js for Vercel.
 * Set API_BASE_URL in the Vercel project (e.g. https://your-service.up.railway.app/index.php).
 */
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "Frontend", "assets", "js", "config.js");

const apiBase =
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.PUBLIC_API_BASE_URL ||
  "";

if (!apiBase) {
  console.warn(
    "vercel-build: API_BASE_URL is not set. Using the default in config.js (localhost). Set API_BASE_URL in Vercel environment variables."
  );
  process.exit(0);
}

let content = fs.readFileSync(configPath, "utf8");
const replaced = content.replace(
  /^const API_BASE_URL = .*?;/m,
  `const API_BASE_URL = ${JSON.stringify(apiBase)};`
);

if (replaced === content) {
  console.error("vercel-build: could not find API_BASE_URL line in config.js");
  process.exit(1);
}

fs.writeFileSync(configPath, replaced);
console.log("vercel-build: API_BASE_URL set for deployment");
