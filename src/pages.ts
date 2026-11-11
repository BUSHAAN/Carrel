import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import type { Auth } from "./auth.js";

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111; color: #eee; }
    main { width: min(28rem, calc(100% - 2rem)); background: #1c1c1c; padding: 1.5rem; border-radius: 12px; }
    label { display: block; margin: 0.75rem 0 0.25rem; font-size: 0.9rem; }
    input { width: 100%; box-sizing: border-box; padding: 0.55rem 0.65rem; border-radius: 8px; border: 1px solid #444; background: #111; color: inherit; }
    button { margin-top: 1rem; width: 100%; padding: 0.65rem; border: 0; border-radius: 8px; background: #5b8cff; color: white; font-weight: 600; cursor: pointer; }
    button.secondary { background: #444; margin-top: 0.5rem; }
    .error { color: #ff8b8b; min-height: 1.2rem; font-size: 0.9rem; }
    p { line-height: 1.45; }
    code { font-size: 0.85rem; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function signInPage(): string {
  return layout(
    "Sign in · Carrel",
    `<h1>Carrel</h1>
     <p>A quiet place for your knowledge to grow. Sign in to let an MCP client use your notes.</p>
     <form id="form">
       <label for="email">Email</label>
       <input id="email" name="email" type="email" autocomplete="username" required />
       <label for="password">Password</label>
       <input id="password" name="password" type="password" autocomplete="current-password" required />
       <p class="error" id="error"></p>
       <button type="submit">Sign in</button>
     </form>
     <script>
       const form = document.getElementById("form");
       const error = document.getElementById("error");
       form.addEventListener("submit", async (event) => {
         event.preventDefault();
         error.textContent = "";
         const body = {
           email: document.getElementById("email").value,
           password: document.getElementById("password").value,
         };
         const response = await fetch("/api/auth/sign-in/email", {
           method: "POST",
           credentials: "include",
           headers: { "content-type": "application/json" },
           body: JSON.stringify(body),
         });
         if (!response.ok) {
           const payload = await response.json().catch(() => ({}));
           error.textContent = payload.message || "Sign in failed";
           return;
         }
         const next = new URLSearchParams(location.search).get("callbackURL");
         location.assign(next || "/consent" + location.search);
       });
     </script>`,
  );
}

export async function consentPage(auth: Auth, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.search.slice(1);
  const { secret } = await auth.$context;
  if (!query || !(await verifyOAuthQueryParams(query, secret))) {
    return new Response(layout("Consent", "<h1>Invalid consent request</h1><p>The authorization query is missing or expired. Start again from your MCP client.</p>"), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const params = new URLSearchParams(query);
  const clientId = params.get("client_id") ?? "unknown client";
  const scope = params.get("scope") ?? "";
  const html = layout(
    "Authorize MCP",
    `<h1>Authorize MCP client</h1>
     <p>Allow this client to read and write your study notes?</p>
     <p><strong>Client</strong><br /><code>${escapeHtml(clientId)}</code></p>
     <p><strong>Scopes</strong><br /><code>${escapeHtml(scope || "(default)")}</code></p>
     <p class="error" id="error"></p>
     <button id="allow" type="button">Allow</button>
     <button id="deny" class="secondary" type="button">Deny</button>
     <script>
       const oauthQuery = ${JSON.stringify(query)};
       async function consent(accept) {
         const response = await fetch("/api/auth/oauth2/consent", {
           method: "POST",
           credentials: "include",
           headers: { "content-type": "application/json" },
           body: JSON.stringify({ accept, oauth_query: oauthQuery }),
         });
         const payload = await response.json().catch(() => ({}));
         if (!response.ok) {
           document.getElementById("error").textContent = payload.message || "Consent failed";
           return;
         }
         if (payload.url) location.assign(payload.url);
       }
       document.getElementById("allow").onclick = () => consent(true);
       document.getElementById("deny").onclick = () => consent(false);
     </script>`,
  );
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
