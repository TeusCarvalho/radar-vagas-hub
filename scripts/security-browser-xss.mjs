// Browser real: detecta execucao de payloads XSS via alert/dialog.
// Apenas GET para paginas publicas; nao altera banco, cookies ou sessoes.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev";
const payloads = [
  { name: "img-onerror", value: '<img src=x onerror=alert("RADAR_XSS_TEST")>' },
  { name: "svg-onload", value: '<svg onload=alert("RADAR_XSS_TEST")>' },
  { name: "script-breakout", value: '"><script>alert("RADAR_XSS_TEST")</script>' },
];
const browser = await chromium.launch({ headless: true });
try {
  for (const { name, value } of payloads) {
    const page = await browser.newPage({ javaScriptEnabled: true });
    const dialogs = [];
    const exceptions = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    page.on("pageerror", (error) => exceptions.push(error.message));
    const url = base + "/vagas?q=" + encodeURIComponent(value);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    assert.ok(response, name + ": resposta ausente");
    assert.equal(response.status(), 200, name + ": HTTP diferente de 200");
    await page.locator("#busca-vagas").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(
      (expected) => document.querySelector("#busca-vagas")?.value === expected,
      value,
      { timeout: 10000 },
    );
    // Permite que scripts e eventos disparados pela hidratacao sejam executados.
    await page.waitForTimeout(1500);
    assert.equal(dialogs.length, 0, name + ": JavaScript executado via dialog: " + dialogs.join(", "));
    console.log("PASSOU XSS-browser " + name + ": valor refletido na busca; zero dialogos");
    if (exceptions.length) {
      console.log("INFO: erros da pagina (nao conclusivos sobre XSS): " + exceptions.length);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("XSS-browser: 3 casos de reflexao testados em Chromium real (nao cobre XSS armazenado).");
