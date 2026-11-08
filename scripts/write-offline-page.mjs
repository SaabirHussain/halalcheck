import { readFile, writeFile } from "node:fs/promises";

const serverUrl = process.env.CAP_SERVER_URL ?? "http://10.0.2.2:3000";
const template = new URL("../mobile/www/offline.template.html", import.meta.url);
const output = new URL("../mobile/www/offline.html", import.meta.url);
const html = await readFile(template, "utf8");
await writeFile(output, html.replaceAll("__CAP_SERVER_URL__", serverUrl));
