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
