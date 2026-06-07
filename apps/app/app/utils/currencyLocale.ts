import { Platform } from "react-native"
import * as Localization from "expo-localization"

/** Currency codes persisted on `profiles.preferred_currency_code`. */
export type PreferredCurrencyCode = "USD" | "GBP" | "EUR" | "SGD" | "JPY" | "INR"

const PREFERRED_CODES: readonly PreferredCurrencyCode[] = ["USD", "GBP", "EUR", "SGD", "JPY", "INR"]

export function isPreferredCurrencyCode(
  value: string | null | undefined,
): value is PreferredCurrencyCode {
  return value != null && (PREFERRED_CODES as readonly string[]).includes(value)
}

/**
 * ISO 3166-1 alpha-2 region from a BCP 47 tag: last `-` segment when it is two letters
 * (e.g. `en-SG` → SG, `zh-Hant-SG` → SG).
 */
export function regionFromLocaleTag(localeTag: string): string | null {
  const normalized = localeTag.replace(/_/g, "-").trim()
  if (!normalized) return null
  const parts = normalized.split("-").filter(Boolean)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1] ?? ""
  if (/^[A-Za-z]{2}$/.test(last)) return last.toUpperCase()
  return null
}

function regionFromIntlResolvedLocale(): string | null {
  try {
    const tag = Intl.NumberFormat().resolvedOptions().locale
    return tag ? regionFromLocaleTag(tag) : null
  } catch {
    return null
  }
}

/** Optional region hints from React Native (varies by OS / version). */
function regionFromPlatformConstants(): string | null {
  try {
    const c = Platform.constants as
      | { region?: string; locales?: readonly string[]; getConstants?: () => { region?: string } }
      | undefined
    const direct = typeof c?.region === "string" ? c.region : undefined
    if (direct && /^[A-Za-z]{2}$/i.test(direct)) return direct.toUpperCase()
    const nested = typeof c?.getConstants === "function" ? c.getConstants()?.region : undefined
    if (nested && /^[A-Za-z]{2}$/i.test(nested)) return nested.toUpperCase()
    const firstLocale = c?.locales?.[0]
    if (typeof firstLocale === "string") {
      const fromTag = regionFromLocaleTag(firstLocale)
      if (fromTag) return fromTag
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Best-effort device region: OS region from expo-localization, then Platform hints,
 * then region parsed from `Intl` resolved locale, then region from the primary locale tag.
 */
export function resolvedDeviceRegionCode(): string | null {
  const primary = Localization.getLocales()[0]
  const fromExpo = primary?.regionCode?.trim()
  if (fromExpo && /^[A-Za-z]{2}$/i.test(fromExpo)) return fromExpo.toUpperCase()

  const fromPlatform = regionFromPlatformConstants()
  if (fromPlatform) return fromPlatform

  const fromIntl = regionFromIntlResolvedLocale()
  if (fromIntl) return fromIntl

  if (primary?.languageTag) {
    const fromTag = regionFromLocaleTag(primary.languageTag)
    if (fromTag) return fromTag
  }

  return null
}

function currencyFromRegion(region: string): PreferredCurrencyCode | null {
  switch (region) {
    case "SG":
      return "SGD"
    case "GB":
      return "GBP"
    case "US":
      return "USD"
    case "DE":
    case "FR":
    case "ES":
    case "IT":
    case "NL":
      return "EUR"
    case "JP":
      return "JPY"
    case "IN":
      return "INR"
    default:
      return null
  }
}

/** Currency for the current device, from region first; unknown region → USD. */
export function deviceCurrencyCode(): PreferredCurrencyCode {
  const region = resolvedDeviceRegionCode()
  if (region) {
    const mapped = currencyFromRegion(region)
    if (mapped) return mapped
  }
  return "USD"
}

export function symbolForCurrencyCode(code: PreferredCurrencyCode): string {
  switch (code) {
    case "GBP":
      return "£"
    case "EUR":
      return "€"
    case "SGD":
      return "S$"
    case "JPY":
      return "¥"
    case "INR":
      return "₹"
    case "USD":
    default:
      return "$"
  }
}
