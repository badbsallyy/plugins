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
