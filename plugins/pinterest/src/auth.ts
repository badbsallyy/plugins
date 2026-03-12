const PINTEREST_AUTH_URL = "https://www.pinterest.com/oauth/"
const PROXY_BASE_URL = "https://pinterest-plugin-proxy.YOUR-DOMAIN.workers.dev"
// Ersetze mit deiner tatsächlichen Proxy-URL

const CLIENT_ID = "DEIN_PINTEREST_APP_ID"
// Client-ID ist öffentlich sichtbar, Client-Secret bleibt im Worker

const REDIRECT_URI = `${PROXY_BASE_URL}/callback`
const SCOPES = "boards:read,pins:read,user_accounts:read"

interface AuthState {
    accessToken: string | null
    isAuthenticated: boolean
}

let authState: AuthState = {
    accessToken: null,
    isAuthenticated: false,
}

// Token aus sessionStorage wiederherstellen (falls vorhanden)
export function restoreAuth(): AuthState {
    const stored = sessionStorage.getItem("pinterest_access_token")
    if (stored) {
        authState = { accessToken: stored, isAuthenticated: true }
    }
    return authState
}

export function getAuthState(): AuthState {
    return authState
}

export function getAccessToken(): string | null {
    return authState.accessToken
}

export function setAccessToken(token: string): void {
    authState = { accessToken: token, isAuthenticated: true }
    sessionStorage.setItem("pinterest_access_token", token)
}

export function clearAuth(): void {
    authState = { accessToken: null, isAuthenticated: false }
    sessionStorage.removeItem("pinterest_access_token")
}

// OAuth 2.0 starten: Popup öffnen
export function startOAuthFlow(): Promise<string> {
    return new Promise((resolve, reject) => {
        const state = crypto.randomUUID()
        sessionStorage.setItem("pinterest_oauth_state", state)

        const authUrl = new URL(PINTEREST_AUTH_URL)
        authUrl.searchParams.set("client_id", CLIENT_ID)
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
        authUrl.searchParams.set("response_type", "code")
        authUrl.searchParams.set("scope", SCOPES)
        authUrl.searchParams.set("state", state)

        const popup = window.open(
            authUrl.toString(),
            "pinterest-oauth",
            "width=600,height=700,scrollbars=yes"
        )

        if (!popup) {
            reject(new Error("Popup konnte nicht geöffnet werden"))
            return
        }

        // Auf Message vom Proxy-Callback lauschen
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== PROXY_BASE_URL) return

            const { access_token, error, state: returnedState } = event.data

            window.removeEventListener("message", handleMessage)

            if (error) {
                reject(new Error(`OAuth Fehler: ${error}`))
                return
            }

            const savedState = sessionStorage.getItem("pinterest_oauth_state")
            if (returnedState !== savedState) {
                reject(new Error("OAuth State mismatch - möglicher CSRF-Angriff"))
                return
            }

            if (access_token) {
                setAccessToken(access_token)
                resolve(access_token)
            } else {
                reject(new Error("Kein Access Token erhalten"))
            }
        }

        window.addEventListener("message", handleMessage)

        // Timeout nach 5 Minuten
        setTimeout(() => {
            window.removeEventListener("message", handleMessage)
            reject(new Error("OAuth Timeout"))
        }, 5 * 60 * 1000)
    })
}
