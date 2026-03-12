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
