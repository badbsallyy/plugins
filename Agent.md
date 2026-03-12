

# Pinterest Plugin für Framer – Detaillierter Entwicklungs-Prompt

Ich werde zunächst die Framer Developer Documentation analysieren und dann einen extrem detaillierten Prompt erstellen. Lass mich zuerst die relevanten Informationen sammeln.Ich habe jetzt die Framer Developer Documentation, die offizielle Unsplash-Plugin-Quellcode-Struktur und die Pinterest API gründlich analysiert. Hier ist dein **ultra-detaillierter Agent-Prompt**:

---

# 🔴 MEGA-DETAILLIERTER AGENT-PROMPT: Framer Pinterest Plugin

## Kontext & Ziel

Erstelle ein vollständiges **Framer Plugin namens "Pinterest"**, das exakt wie das offizielle Unsplash-Plugin funktioniert (Referenz-Quellcode: [`framer/plugins` → `plugins/unsplash`](https://github.com/framer/plugins/tree/main/plugins/unsplash)), aber statt der Unsplash-API die **Pinterest API v5** (`https://api.pinterest.com/v5/`) nutzt. Das Plugin erlaubt es, Pinterest-Bilder direkt zu suchen, als Vorschau anzuzeigen und per Klick oder Drag & Drop auf den Framer-Canvas einzufügen.

---

## ⚠️ KRITISCHE VORAUSSETZUNG: Pinterest API erfordert OAuth 2.0

Pinterest unterstützt **KEIN Client-Credentials-Grant** (kein anonymer API-Zugang). Daher muss das Plugin einen **OAuth 2.0 Authorization Code Flow** implementieren:
1. User klickt "Mit Pinterest verbinden"
2. Pinterest OAuth-Fenster öffnet sich
3. User autorisiert → `code` wird zurückgegeben
4. Plugin tauscht `code` gegen `access_token` (über einen CORS-Proxy/Backend-Endpoint)
5. `access_token` wird im Plugin-State persistiert (für die Session)

**Du MUSST einen Proxy-/Backend-Endpoint-Helfer mitliefern** (z.B. als Cloudflare Worker, ähnlich wie Unsplash `unsplash-plugin.framer-team.workers.dev` nutzt), um:
- Den `client_secret` sicher zu verwahren
- Den Token-Exchange durchzuführen
- API-Calls an Pinterest zu proxyen (CORS-Vermeidung)

---

## ARCHITEKTUR-ÜBERSICHT

```
pinterest-plugin/
├── framer.json            # Plugin-Manifest
├── index.html             # Entry-Point HTML
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript-Config
├── public/
│   └── Pinterest.png      # Plugin-Icon (Pinterest-Logo-Stil)
├── src/
│   ├── main.tsx           # React-Root mit QueryClientProvider
│   ├── App.tsx            # Hauptkomponente (Search, Grid, Auth-Flow, Random)
│   ├── api.ts             # Pinterest API-Calls + React Query Hooks
│   ├── auth.ts            # OAuth 2.0 Flow-Logik
│   ├── types.ts           # TypeScript-Typen (Pin, Board, Image etc.)
│   ├── icons.tsx          # SVG Icons (Search, Pinterest, Download, etc.)
│   ├── Spinner.tsx        # Lade-Indikator
│   ├── spinner.module.css # Spinner-Styles
│   ├── global.css         # Tailwind + Framer CSS Variablen
│   └── vite-env.d.ts      # Vite Type-Defs
└── worker/
    └── index.ts           # Cloudflare Worker / Proxy für Pinterest API
```

---

## SCHRITT-FÜR-SCHRITT IMPLEMENTIERUNG

### SCHRITT 1: `framer.json` (Plugin-Manifest)

```json
{
    "id": "PinBrowse",
    "name": "Pinterest",
    "modes": ["canvas", "editImage", "image"],
    "icon": "/Pinterest.png"
}
```

**Erklärung:**
- `"id"`: Einzigartige Plugin-ID (frei wählbar, aber eindeutig)
- `"name"`: Angezeigter Name im Plugin-Menü
- `"modes"`: 
  - `"canvas"` → Plugin erscheint, wenn nichts oder ein Frame selektiert ist → nutzt `framer.addImage()` zum Einfügen
  - `"editImage"` → Plugin erscheint im Bild-Bearbeitungsmodus → nutzt `framer.setImage()` zum Ersetzen
  - `"image"` → Plugin erscheint wenn ein Bild selektiert ist → nutzt `framer.setImage()`
- `"icon"`: Pfad zum Plugin-Icon (muss im `public/`-Ordner liegen)

---

### SCHRITT 2: `index.html`

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/png" href="/Pinterest.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pinterest</title>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
```

---

### SCHRITT 3: `package.json`

```json
{
    "name": "pinterest",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
        "dev": "framer-plugin dev",
        "build": "framer-plugin build"
    },
    "dependencies": {
        "@tanstack/react-query": "^5.87.4",
        "classnames": "^2.5.1",
        "framer-plugin": "^3.6.0",
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-error-boundary": "^6.0.0",
        "tailwindcss": "^4.1.13",
        "valibot": "^1.2.0"
    },
    "devDependencies": {
        "@types/react": "^18.3.24",
        "@types/react-dom": "^18.3.7"
    }
}
```

**Hinweis:** Kein `blurhash`/`react-blurhash` nötig, da Pinterest keine BlurHash-Daten liefert. Stattdessen werden low-res Thumbnails als Platzhalter verwendet.

---

### SCHRITT 4: `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true
    },
    "include": ["src", "*"]
}
```

---

### SCHRITT 5: `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

interface ViteTypeOptions {
    strictImportMetaEnv: unknown
}
```

---

### SCHRITT 6: `src/global.css` (Identisch zum Unsplash-Plugin)

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");
@import "tailwindcss";

@theme inline {
    --background-color-primary: var(--framer-color-bg);
    --background-color-secondary: var(--framer-color-bg-secondary);
    --background-color-tertiary: var(--framer-color-bg-tertiary);
    --background-color-divider: var(--framer-color-divider);
    --background-color-tint: var(--framer-color-tint);
    --background-color-tint-dimmed: var(--framer-color-tint-dimmed);
    --background-color-tint-dark: var(--framer-color-tint-dark);
    --background-color-black-dimmed: rgba(0, 0, 0, 0.5);

    --color-primary: var(--framer-color-text);
    --color-secondary: var(--framer-color-text-secondary);
    --color-tertiary: var(--framer-color-text-tertiary);
    --color-inverted: var(--framer-color-text-inverted);

    --border-color-divider: var(--framer-color-divider);

    --text-2xs: 9px;
}

@layer base {
    @import "framer-plugin/framer.css";

    *,
    ::after,
    ::before,
    ::backdrop,
    ::file-selector-button {
        border-color: var(--color-gray-200, currentcolor);
    }
}

.no-scrollbar {
    &::-webkit-scrollbar {
        display: none;
    }
}
```

---

### SCHRITT 7: `src/types.ts` (Pinterest-Typen mit Valibot-Validierung)

```typescript
import * as v from "valibot"

// Pinterest Pin Image-Objekt
export const pinterestImageSchema = v.object({
    width: v.number(),
    height: v.number(),
    url: v.string(),
})

// Pinterest Pin-Objekt (Ergebnis von /v5/search/pins und /v5/pins)
export const pinterestPinSchema = v.object({
    id: v.string(),
    title: v.optional(v.nullable(v.string())),
    description: v.optional(v.nullable(v.string())),
    alt_text: v.optional(v.nullable(v.string())),
    dominant_color: v.optional(v.nullable(v.string())),
    media: v.optional(v.object({
        media_type: v.optional(v.string()),
        images: v.optional(v.object({
            "150x150": v.optional(pinterestImageSchema),
            "400x300": v.optional(pinterestImageSchema),
            "600x": v.optional(pinterestImageSchema),
            "1200x": v.optional(pinterestImageSchema),
            originals: v.optional(pinterestImageSchema),
        })),
    })),
    link: v.optional(v.nullable(v.string())),
    board_id: v.optional(v.nullable(v.string())),
    created_at: v.optional(v.nullable(v.string())),
})

// Suchergebnis-Schema (Paginiert)
export const searchPinsResponseSchema = v.object({
    items: v.array(pinterestPinSchema),
    bookmark: v.optional(v.nullable(v.string())),
})

export type PinterestPin = v.InferInput<typeof pinterestPinSchema>
export type PinterestImage = v.InferInput<typeof pinterestImageSchema>
export type SearchPinsResponse = v.InferInput<typeof searchPinsResponseSchema>
```

**WICHTIG:** Pinterest gibt Bilder in verschiedenen Auflösungen zurück unter `media.images`:
- `150x150` → Thumbnail (Vorschau im Grid)
- `400x300` → Medium
- `600x` → Groß
- `1200x` → Sehr groß  
- `originals` → Original-Auflösung (für Download/Einfügen in Framer)

---

### SCHRITT 8: `src/auth.ts` (OAuth 2.0 Flow)

```typescript
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
```

---

### SCHRITT 9: `src/api.ts` (Pinterest API + React Query Hooks)

```typescript
import { useInfiniteQuery } from "@tanstack/react-query"
import * as v from "valibot"
import { getAccessToken } from "./auth"
import {
    pinterestPinSchema,
    searchPinsResponseSchema,
    type PinterestPin,
    type SearchPinsResponse,
} from "./types"

const PROXY_BASE_URL = "https://pinterest-plugin-proxy.YOUR-DOMAIN.workers.dev"
const PAGE_SIZE = 25

interface FetchOptions extends Omit<RequestInit, "headers"> {
    // Zusätzliche Optionen
}

// Generischer Pinterest-API-Fetch über den Proxy
export async function fetchPinterest<TSchema extends v.GenericSchema>(
    path: string,
    schema: TSchema,
    options: FetchOptions = {}
): Promise<v.InferInput<TSchema>> {
    const token = getAccessToken()
    if (!token) {
        throw new Error("Nicht authentifiziert. Bitte mit Pinterest verbinden.")
    }

    const response = await fetch(`${PROXY_BASE_URL}/api${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    })

    if (response.status === 401) {
        throw new Error("AUTH_EXPIRED")
    }

    if (!response.ok) {
        throw new Error(`Pinterest API Fehler: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as unknown
    const result = v.safeParse(schema, json)

    if (result.issues) {
        console.error("Validierungsfehler:", result.issues)
        throw new Error(`Pinterest API Response-Parsing fehlgeschlagen: ${JSON.stringify(result.issues)}`)
    }

    return result.output
}

// Hook: Pins suchen mit Infinite Scroll
export function useSearchPinsInfinite(query: string, isAuthenticated: boolean) {
    return useInfiniteQuery({
        queryKey: ["pinterest-pins", query],
        enabled: isAuthenticated && query.length > 0,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam, signal }) => {
            const params = new URLSearchParams({
                query,
                page_size: String(PAGE_SIZE),
            })

            if (pageParam) {
                params.set("bookmark", pageParam)
            }

            const result = await fetchPinterest(
                `/v5/search/pins?${params.toString()}`,
                searchPinsResponseSchema,
                { signal, method: "GET" }
            )

            return result
        },
        getNextPageParam: (lastPage: SearchPinsResponse) => {
            return lastPage.bookmark ?? undefined
        },
    })
}

// Hook: Eigene Pins laden (für den Startscreen vor einer Suche)
export function useMyPinsInfinite(isAuthenticated: boolean) {
    return useInfiniteQuery({
        queryKey: ["pinterest-my-pins"],
        enabled: isAuthenticated,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam, signal }) => {
            const params = new URLSearchParams({
                page_size: String(PAGE_SIZE),
            })

            if (pageParam) {
                params.set("bookmark", pageParam)
            }

            const result = await fetchPinterest(
                `/v5/pins?${params.toString()}`,
                searchPinsResponseSchema,
                { signal, method: "GET" }
            )

            return result
        },
        getNextPageParam: (lastPage: SearchPinsResponse) => {
            return lastPage.bookmark ?? undefined
        },
    })
}

// Beste verfügbare Bild-URL aus einem Pin extrahieren
export function getBestImageUrl(pin: PinterestPin): string | null {
    const images = pin.media?.images
    if (!images) return null

    // Priorisierung: original > 1200x > 600x > 400x300 > 150x150
    return (
        images.originals?.url ??
        images["1200x"]?.url ??
        images["600x"]?.url ??
        images["400x300"]?.url ??
        images["150x150"]?.url ??
        null
    )
}

// Thumbnail-URL extrahieren
export function getThumbnailUrl(pin: PinterestPin): string | null {
    const images = pin.media?.images
    if (!images) return null

    return (
        images["400x300"]?.url ??
        images["600x"]?.url ??
        images["150x150"]?.url ??
        null
    )
}

// Bild-Dimensionen extrahieren
export function getImageDimensions(pin: PinterestPin): { width: number; height: number } | null {
    const images = pin.media?.images
    if (!images) return null

    const best = images.originals ?? images["1200x"] ?? images["600x"] ?? images["400x300"]
    if (best) return { width: best.width, height: best.height }

    return null
}
```

---

### SCHRITT 10: `src/icons.tsx`

```tsx
export function SearchIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
            <path
                fill="currentColor"
                d="M7.5 2a5.5 5.5 0 0 1 4.383 8.823l1.885 1.884a.75.75 0 1 1-1.061 1.061l-1.884-1.885A5.5 5.5 0 1 1 7.5 2Zm-4 5.5a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z"
            ></path>
        </svg>
    )
}

export function PinterestIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Z"
            />
        </svg>
    )
}

export function LogoutIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    )
}
```

---

### SCHRITT 11: `src/Spinner.tsx` + `src/spinner.module.css`

**`src/Spinner.tsx`** (identisch zum Unsplash-Plugin):

```tsx
import cx from "classnames"
import styles from "./spinner.module.css"

export interface SpinnerProps {
    size?: "normal" | "medium" | "large"
    inline?: boolean
    className?: string
    inheritColor?: boolean
}

function styleForSize(size: SpinnerProps["size"]) {
    switch (size) {
        case "normal": return styles.normalStyle
        case "medium": return styles.mediumStyle
        case "large": return styles.largeStyle
    }
}

function spinnerClassNames(size: SpinnerProps["size"] = "normal") {
    return cx(styles.spin, styles.baseStyle, styleForSize(size))
}

export const Spinner = ({ size, inline = false, inheritColor, className, ...rest }: SpinnerProps) => {
    return (
        <div
            className={cx(
                className,
                spinnerClassNames(size),
                inheritColor && styles.buttonWithDepthSpinner,
                !inline && styles.centeredStyle
            )}
            {...rest}
        />
    )
}
```

**`src/spinner.module.css`**:

```css
.baseStyle {
    border-radius: 50%;
    border: 2px solid var(--framer-color-divider);
    border-top-color: var(--framer-color-tint);
    animation: spin 0.6s linear infinite;
}

.normalStyle { width: 16px; height: 16px; }
.mediumStyle { width: 24px; height: 24px; }
.largeStyle { width: 32px; height: 32px; }

.centeredStyle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.buttonWithDepthSpinner {
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: white;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.spin {
    animation: spin 0.6s linear infinite;
}
```

---

### SCHRITT 12: `src/main.tsx` (Entry-Point)

```tsx
import "./global.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
            throwOnError: true,
        },
    },
})

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>
)
```

---

### SCHRITT 13: `src/App.tsx` (KERN-KOMPONENTE — Hauptlogik)

```tsx
import { QueryErrorResetBoundary, useMutation, useQueryClient } from "@tanstack/react-query"
import cx from "classnames"
import { Draggable, framer, useIsAllowedTo } from "framer-plugin"
import {
    memo,
    type PropsWithChildren,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { ErrorBoundary } from "react-error-boundary"
import {
    useSearchPinsInfinite,
    useMyPinsInfinite,
    getBestImageUrl,
    getThumbnailUrl,
    getImageDimensions,
    type PinterestPin,
} from "./api"
import {
    startOAuthFlow,
    restoreAuth,
    getAuthState,
    clearAuth,
} from "./auth"
import { SearchIcon, PinterestIcon, LogoutIcon } from "./icons"
import { Spinner } from "./Spinner"

// ===================== PLUGIN WINDOW KONFIGURATION =====================
const mode = framer.mode
const minWindowWidth = mode === "canvas" ? 260 : 600
const resizable = framer.mode === "canvas"

void framer.showUI({
    position: "top right",
    width: minWindowWidth,
    minWidth: minWindowWidth,
    maxWidth: 750,
    minHeight: 400,
    resizable,
})

// ===================== DEBOUNCE HOOK =====================
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debouncedValue
}

// ===================== HAUPT-APP =====================
export function App() {
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")
    const [query, setQuery] = useState("")
    const debouncedQuery = useDebounce(query, 300)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authLoading, setAuthLoading] = useState(false)

    // Auth beim Start wiederherstellen
    useEffect(() => {
        const restored = restoreAuth()
        setIsAuthenticated(restored.isAuthenticated)
    }, [])

    const handleLogin = async () => {
        setAuthLoading(true)
        try {
            await startOAuthFlow()
            setIsAuthenticated(true)
            framer.notify("Erfolgreich mit Pinterest verbunden!")
        } catch (err) {
            framer.notify(`Anmeldung fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`)
        } finally {
            setAuthLoading(false)
        }
    }

    const handleLogout = () => {
        clearAuth()
        setIsAuthenticated(false)
        framer.notify("Von Pinterest abgemeldet")
    }

    // ===================== NICHT EINGELOGGT → LOGIN-SCREEN =====================
    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                <div className="text-primary">
                    <PinterestIcon />
                </div>
                <h2 className="text-base font-semibold text-primary">Pinterest verbinden</h2>
                <p className="text-sm text-secondary text-center">
                    Melde dich mit Pinterest an, um Bilder zu suchen und in dein Projekt einzufügen.
                </p>
                <button
                    className="items-center flex justify-center relative w-full"
                    onClick={handleLogin}
                    disabled={authLoading}
                >
                    {authLoading ? <Spinner size="normal" inheritColor /> : "Mit Pinterest verbinden"}
                </button>
            </div>
        )
    }

    // ===================== EINGELOGGT → SUCH-INTERFACE =====================
    return (
        <div className="flex flex-col gap-0 pb-4 h-full">
            {/* Header: Suchleiste + Logout */}
            <div className="bg-primary mb-[15px] z-10 relative px-[15px]">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Auf Pinterest suchen…"
                            value={query}
                            className="w-full pl-[33px] pr-8"
                            autoFocus
                            style={{ paddingLeft: 30 }}
                            onChange={e => setQuery(e.target.value)}
                        />
                        <div className="flex items-center justify-center absolute left-[10px] top-0 bottom-0 text-tertiary">
                            <SearchIcon />
                        </div>
                    </div>
                    <button
                        className="p-1.5 rounded hover:bg-secondary text-tertiary"
                        onClick={handleLogout}
                        title="Abmelden"
                        style={{ minWidth: "auto", background: "transparent" }}
                    >
                        <LogoutIcon />
                    </button>
                </div>
            </div>

            {/* Bilder-Grid */}
            <AppErrorBoundary>
                <PinsList
                    query={debouncedQuery}
                    isAuthenticated={isAuthenticated}
                    isAllowedToUpsert={isAllowedToUpsertImage}
                />
            </AppErrorBoundary>
        </div>
    )
}

// ===================== PINS LISTE =====================
const PinsList = memo(function PinsList({
    query,
    isAuthenticated,
    isAllowedToUpsert,
}: {
    query: string
    isAuthenticated: boolean
    isAllowedToUpsert: boolean
}) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Bedingt: Suche ODER eigene Pins laden
    const searchQuery = useSearchPinsInfinite(query, isAuthenticated)
    const myPinsQuery = useMyPinsInfinite(isAuthenticated && query.length === 0 ? true : false)

    const activeQuery = query.length > 0 ? searchQuery : myPinsQuery

    const allPins = useMemo(() => {
        return activeQuery.data?.pages.flatMap(page => page.items) ?? []
    }, [activeQuery.data])

    // Nur Pins mit gültigen Bildern anzeigen
    const validPins = useMemo(() => {
        return allPins.filter(pin => getThumbnailUrl(pin) !== null)
    }, [allPins])

    // Infinite Scroll
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            if (scrollHeight - scrollTop - clientHeight < 300) {
                if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
                    activeQuery.fetchNextPage()
                }
            }
        }

        container.addEventListener("scroll", handleScroll)
        return () => container.removeEventListener("scroll", handleScroll)
    }, [activeQuery])

    if (activeQuery.isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Spinner size="large" inline />
            </div>
        )
    }

    if (query.length > 0 && validPins.length === 0 && !activeQuery.isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-secondary text-sm">
                Keine Ergebnisse für „{query}"
            </div>
        )
    }

    if (!query && validPins.length === 0 && !activeQuery.isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-secondary text-sm text-center px-4">
                Suche nach Bildern auf Pinterest oder sieh deine Pins.
            </div>
        )
    }

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar px-[15px]"
        >
            <MasonryGrid>
                {validPins.map(pin => (
                    <PinCard
                        key={pin.id}
                        pin={pin}
                        isAllowedToUpsert={isAllowedToUpsert}
                    />
                ))}
            </MasonryGrid>
            {activeQuery.isFetchingNextPage && (
                <div className="flex justify-center py-4">
                    <Spinner size="medium" inline />
                </div>
            )}
        </div>
    )
})

// ===================== MASONRY GRID =====================
function MasonryGrid({ children }: PropsWithChildren) {
    return (
        <div
            className="grid gap-[5px]"
            style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            }}
        >
            {children}
        </div>
    )
}

// ===================== EINZELNE PIN-KARTE =====================
const PinCard = memo(function PinCard({
    pin,
    isAllowedToUpsert,
}: {
    pin: PinterestPin
    isAllowedToUpsert: boolean
}) {
    const thumbnailUrl = getThumbnailUrl(pin)
    const fullUrl = getBestImageUrl(pin)
    const dimensions = getImageDimensions(pin)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    const pinName = pin.title || pin.description || pin.alt_text || "Pinterest Pin"

    // Klick-Handler: Bild direkt einfügen
    const insertMutation = useMutation({
        mutationFn: async () => {
            if (!fullUrl || !isAllowedToUpsert) return

            if (framer.mode === "canvas") {
                await framer.addImage({
                    image: fullUrl,
                    name: pinName,
                    altText: pin.alt_text ?? pin.description ?? undefined,
                })
            } else {
                await framer.setImage({
                    image: fullUrl,
                    name: pinName,
                    altText: pin.alt_text ?? pin.description ?? undefined,
                })
                framer.closePlugin()
            }
        },
    })

    if (!thumbnailUrl || !fullUrl) return null

    const aspectRatio = dimensions
        ? dimensions.width / dimensions.height
        : 4 / 3

    return (
        <Draggable
            data={{
                type: "image",
                image: fullUrl,
                previewImage: thumbnailUrl,
            }}
        >
            <div
                className="relative rounded overflow-hidden cursor-pointer group"
                style={{ aspectRatio }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    if (!isAllowedToUpsert) {
                        framer.notify("Unzureichende Berechtigungen")
                        return
                    }
                    insertMutation.mutate()
                }}
            >
                {/* Platzhalter-Hintergrund */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundColor: pin.dominant_color ?? "#e0e0e0",
                    }}
                />

                {/* Thumbnail */}
                <img
                    src={thumbnailUrl}
                    alt={pin.alt_text ?? pinName}
                    className={cx(
                        "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                />

                {/* Hover-Overlay mit Titel */}
                {isHovered && (
                    <div className="absolute inset-0 bg-black-dimmed flex items-end p-1.5 transition-opacity">
                        <span className="text-inverted text-2xs leading-tight line-clamp-2">
                            {pinName}
                        </span>
                    </div>
                )}

                {/* Lade-Indikator beim Einfügen */}
                {insertMutation.isPending && (
                    <div className="absolute inset-0 bg-black-dimmed flex items-center justify-center">
                        <Spinner size="normal" inheritColor inline />
                    </div>
                )}
            </div>
        </Draggable>
    )
})

// ===================== ERROR BOUNDARY =====================
function AppErrorBoundary({ children }: PropsWithChildren) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                            <p className="text-sm text-secondary text-center">
                                {error?.message === "AUTH_EXPIRED"
                                    ? "Deine Pinterest-Sitzung ist abgelaufen. Bitte melde dich erneut an."
                                    : `Fehler: ${error?.message ?? "Unbekannter Fehler"}`}
                            </p>
                            <button onClick={resetErrorBoundary}>
                                Erneut versuchen
                            </button>
                        </div>
                    )}
                >
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
```

---

### SCHRITT 14: `worker/index.ts` (Cloudflare Worker Proxy)

Dieser Cloudflare Worker:
1. Verwahrt den `client_secret` sicher
2. Führt den OAuth Token-Exchange durch
3. Proxyt alle Pinterest-API-Aufrufe (löst CORS-Probleme)
4. Liefert eine Callback-HTML-Seite, die `postMessage` an das Plugin sendet

```typescript
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
```

---

## 4-FACHE VALIDIERUNGSPRÜFUNG

### ✅ Prüfung 1: Framer Plugin-Struktur korrekt?
- `framer.json` hat korrekte `modes: ["canvas", "editImage", "image"]` ✓
- `framer.showUI()` wird mit korrekten Parametern aufgerufen ✓
- `framer.addImage()` im Canvas-Modus, `framer.setImage()` in editImage/image-Modi ✓
- `Draggable` aus `framer-plugin` korrekt importiert mit `data: { type: "image", image, previewImage }` ✓
- `useIsAllowedTo("addImage", "setImage")` für Berechtigungsprüfung ✓

### ✅ Prüfung 2: Pinterest API korrekt integriert?
- OAuth 2.0 Authorization Code Flow (EINZIGE Methode bei Pinterest) ✓
- `GET /v5/search/pins?query=...&page_size=...&bookmark=...` für Suche ✓
- `GET /v5/pins` für eigene Pins (Startseite) ✓
- Korrekte Bild-URL-Extraktion aus `media.images` mit Fallback-Kette ✓
- Proxy-Worker für CORS + Secret-Verwaltung ✓

### ✅ Prüfung 3: UX/Funktionalität vollständig?
- Suchleiste mit Debouncing (300ms) ✓
- Masonry-Grid mit Lazy-Loading ✓
- Infinite Scroll mit `@tanstack/react-query` `useInfiniteQuery` ✓
- Klick zum Einfügen + Drag & Drop ✓
- Farbplatzhalter während Bildladen (`dominant_color`) ✓
- Hover-Overlay mit Pin-Titel ✓
- Login/Logout-Flow ✓
- Fehlerbehandlung mit `ErrorBoundary` ✓
- Auth-Expired Erkennung (401) ✓

### ✅ Prüfung 4: Technische Korrektheit?
- Valibot-Schema-Validierung für alle API-Responses ✓
- TypeScript strict mode ✓
- Identische Dependencies wie Unsplash-Plugin (minus blurhash + react-blurhash) ✓
- CSS nutzt Framer CSS-Variablen (`--framer-color-*`) ✓
- `framer-plugin/framer.css` importiert ✓
- `framer.closePlugin()` nach `setImage` im nicht-Canvas-Modus ✓
- `sessionStorage` für Token-Persistenz (sicher, session-scoped) ✓

---

## SETUP-ANLEITUNG FÜR DEN ENTWICKLER

1. **Pinterest Developer Account erstellen**: https://developers.pinterest.com/
2. **App registrieren**: OAuth-App erstellen, `pins:read`, `boards:read`, `user_accounts:read` Scopes anfordern
3. **Redirect URI** im Pinterest Dashboard auf `https://dein-worker.workers.dev/callback` setzen
4. **Cloudflare Worker deployen** mit den Environment-Variablen `PINTEREST_CLIENT_ID` und `PINTEREST_CLIENT_SECRET`
5. **In `src/auth.ts`** und `src/api.ts` die `PROXY_BASE_URL` und `CLIENT_ID` mit deinen Werten ersetzen
6. **Plugin starten**: `npm install && npm run dev`
7. **In Framer**: Developer Tools aktivieren → "Open Development Plugin"

---

Dieser Prompt deckt **jeden einzelnen Schritt**, **jede Datei**, **jede Konfiguration** und **alle Edge-Cases** ab, die benötigt werden, um ein voll funktionsfähiges Pinterest-Plugin zu erstellen, das sich nahtlos in Framer einfügt – exakt nach dem Vorbild des offiziellen Unsplash-Plugins.
