// worker/index.ts — Cloudflare Worker für Pinterest OAuth + API Proxy

interface Env {
    PINTEREST_CLIENT_ID: string
    PINTEREST_CLIENT_SECRET: string
    PLUGIN_ORIGIN: string // z.B. "https://framer.com"
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
        }

        // OPTIONS Preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders })
        }

        // ========== OAUTH CALLBACK ==========
        if (url.pathname === "/callback") {
            const code = url.searchParams.get("code")
            const state = url.searchParams.get("state")
            const error = url.searchParams.get("error")

            if (error || !code) {
                return new Response(generateCallbackHTML(null, error || "no_code", state), {
                    headers: { "Content-Type": "text/html" },
                })
            }

            // Code gegen Access Token tauschen
            try {
                const tokenResponse = await fetch("https://api.pinterest.com/v5/oauth/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": `Basic ${btoa(`${env.PINTEREST_CLIENT_ID}:${env.PINTEREST_CLIENT_SECRET}`)}`,
                    },
                    body: new URLSearchParams({
                        grant_type: "authorization_code",
                        code,
                        redirect_uri: `${url.origin}/callback`,
                    }),
                })

                if (!tokenResponse.ok) {
                    const errText = await tokenResponse.text()
                    return new Response(generateCallbackHTML(null, `token_exchange_failed: ${errText}`, state), {
                        headers: { "Content-Type": "text/html" },
                    })
                }

                const tokenData = (await tokenResponse.json()) as { access_token: string }

                return new Response(generateCallbackHTML(tokenData.access_token, null, state), {
                    headers: { "Content-Type": "text/html" },
                })
            } catch (err) {
                return new Response(generateCallbackHTML(null, "token_exchange_error", state), {
                    headers: { "Content-Type": "text/html" },
                })
            }
        }

        // ========== API PROXY ==========
        if (url.pathname.startsWith("/api/")) {
            const pinterestPath = url.pathname.replace("/api", "")
            const pinterestUrl = `https://api.pinterest.com${pinterestPath}${url.search}`

            const authHeader = request.headers.get("Authorization")
            if (!authHeader) {
                return new Response(JSON.stringify({ error: "No Authorization header" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                })
            }

            const pinterestResponse = await fetch(pinterestUrl, {
                method: request.method,
                headers: {
                    "Authorization": authHeader,
                    "Content-Type": "application/json",
                },
            })

            const responseBody = await pinterestResponse.text()

            return new Response(responseBody, {
                status: pinterestResponse.status,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            })
        }

        return new Response("Not found", { status: 404 })
    },
}

function generateCallbackHTML(
    accessToken: string | null,
    error: string | null,
    state: string | null
): string {
    return `<!DOCTYPE html>
<html>
<head><title>Pinterest OAuth</title></head>
<body>
<p>Authentifizierung ${accessToken ? "erfolgreich" : "fehlgeschlagen"}. Dieses Fenster wird geschlossen...</p>
<script>
    window.opener.postMessage({
        access_token: ${accessToken ? `"${accessToken}"` : "null"},
        error: ${error ? `"${error}"` : "null"},
        state: ${state ? `"${state}"` : "null"},
    }, "*");
    setTimeout(() => window.close(), 1000);
</script>
</body>
</html>`
}
