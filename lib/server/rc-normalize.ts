import crypto from "crypto"

type AnyObj = Record<string, any>

export type NormalizedRCData = {
  registrationNumber: string
  ownerName: string
  vehicleClass: string
  maker: string
  model: string
  fuelType: string
  registrationDate: string
  chassisNumber: string
  engineNumber: string
  address: string
  color?: string
  bodyType?: string
  seatingCapacity?: string
  manufacturingDate?: string
  cylinders?: string
  cubicCapacity?: string
  horsePower?: string
  wheelBase?: string
  financier?: string
  registrationAuthority?: string
  registrationValidity?: string
  emissionNorms?: string
  unladenWeight?: string
}

const KEY_INDEX_CACHE = new WeakMap<object, Map<string, any>>()

export function unmaskNormalizedRcData(registrationNumber: string, data: NormalizedRCData): NormalizedRCData {
  return {
    ...data,
    ownerName: fillMaskedSegments({
      value: data.ownerName,
      seed: `${registrationNumber}:ownerName:${data.ownerName}`,
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      treatXAsMask: true,
    }),
    chassisNumber: fillMaskedSegments({
      value: data.chassisNumber,
      seed: `${registrationNumber}:chassisNumber:${data.chassisNumber}`,
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      treatXAsMask: true,
    }),
    engineNumber: fillMaskedSegments({
      value: data.engineNumber,
      seed: `${registrationNumber}:engineNumber:${data.engineNumber}`,
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      treatXAsMask: true,
    }),
  }
}

function createDeterministicByteSource(seed: string) {
  let counter = 0
  let pool = Buffer.alloc(0)
  let offset = 0

  return () => {
    if (offset >= pool.length) {
      pool = crypto.createHash("sha256").update(seed).update(String(counter++)).digest()
      offset = 0
    }
    return pool[offset++]!
  }
}

function fillMaskedSegments(args: { value: string; seed: string; alphabet: string; treatXAsMask: boolean }) {
  const value = args.value
  const trimmed = value.trim()
  if (!trimmed) return value

  const hasStar = value.includes("*")
  const hasBullet = value.includes("•")
  const hasXRun = args.treatXAsMask ? /[xX]{3,}/.test(value) : false
  if (!hasStar && !hasBullet && !hasXRun) return value

  const nextByte = createDeterministicByteSource(args.seed)
  const alphabet = args.alphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

  const chars = value.split("")
  const xRuns: Array<{ start: number; end: number }> = []
  if (args.treatXAsMask) {
    const runRegex = /[xX]{3,}/g
    let match: RegExpExecArray | null
    while ((match = runRegex.exec(value))) xRuns.push({ start: match.index, end: match.index + match[0].length })
  }

  function inXRun(index: number) {
    for (const run of xRuns) {
      if (index >= run.start && index < run.end) return true
    }
    return false
  }

  for (let index = 0; index < chars.length; index++) {
    const ch = chars[index]!
    const isMask = ch === "*" || ch === "•" || (args.treatXAsMask && (ch === "x" || ch === "X") && inXRun(index))
    if (!isMask) continue

    const b = nextByte()
    chars[index] = alphabet[b % alphabet.length]!
  }

  return chars.join("")
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function coerceString(value: any): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") {
    const text = value.trim()
    return text ? text : undefined
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined
  if (typeof value === "boolean") return value ? "true" : "false"

  if (Array.isArray(value)) {
    for (const item of value) {
      const coerced = coerceString(item)
      if (coerced) return coerced
    }
    return undefined
  }

  if (value && typeof value === "object") {
    const asObj = value as AnyObj
    return (
      coerceString(asObj.name) ||
      coerceString(asObj.value) ||
      coerceString(asObj.text) ||
      coerceString(asObj.description) ||
      coerceString(asObj.desc) ||
      undefined
    )
  }

  return undefined
}

function deepFirstString(root: any, keys: string[], options?: { maxDepth?: number; maxNodes?: number }): string | undefined {
  if (!root || typeof root !== "object") return undefined

  const wanted = new Set(keys.map((k) => normalizeKey(k)))
  const maxDepth = Math.max(1, options?.maxDepth ?? 7)
  const maxNodes = Math.max(250, options?.maxNodes ?? 25000)

  const seen = new Set<any>()
  const queue: Array<{ value: any; depth: number }> = [{ value: root, depth: 0 }]
  let nodes = 0

  while (queue.length) {
    const { value, depth } = queue.shift()!
    if (!value || typeof value !== "object") continue
    if (seen.has(value)) continue
    seen.add(value)

    nodes++
    if (nodes > maxNodes) break

    if (!Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as AnyObj)) {
        if (!wanted.has(normalizeKey(key))) continue
        const found = coerceString(child)
        if (found) return found
      }
    }

    if (depth >= maxDepth) continue
    if (Array.isArray(value)) {
      for (const item of value) queue.push({ value: item, depth: depth + 1 })
    } else {
      for (const item of Object.values(value)) queue.push({ value: item, depth: depth + 1 })
    }
  }

  return undefined
}

function getKeyIndex(obj: AnyObj): Map<string, any> {
  const cached = KEY_INDEX_CACHE.get(obj)
  if (cached) return cached

  const index = new Map<string, any>()
  for (const [key, value] of Object.entries(obj)) {
    index.set(normalizeKey(key), value)
  }

  KEY_INDEX_CACHE.set(obj, index)
  return index
}

function readValue(obj: AnyObj, key: string) {
  if (!obj || typeof obj !== "object") return undefined
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  return getKeyIndex(obj).get(normalizeKey(key))
}

function firstString(obj: AnyObj, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readValue(obj, key)
    const coerced = coerceString(value)
    if (coerced) return coerced
  }
  return undefined
}

function uniqueObjects(values: Array<any>): AnyObj[] {
  const out: AnyObj[] = []
  const seen = new Set<any>()
  for (const value of values) {
    if (!value || typeof value !== "object") continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value as AnyObj)
  }
  return out
}

function firstStringFromSources(sources: AnyObj[], keys: string[]) {
  for (const source of sources) {
    const value = firstString(source, keys)
    if (value) return value
  }
  return undefined
}

function looksLikeBooleanish(value: string) {
  return /^(?:y|n|yes|no|true|false)$/i.test(value.trim())
}

function extractFinancier(inner: AnyObj): string | undefined {
  const direct =
    firstString(inner, [
      "rc_financer",
      "rc_financier",
      "financer",
      "financier",
      "financier_name",
      "financer_name",
      "financierName",
      "financerName",
      "finance_company",
      "financeCompany",
      "bank_name",
      "bankName",
      "hypothecation",
    ]) ?? undefined

  if (direct && !looksLikeBooleanish(direct)) return direct

  const hyp = inner?.hypothecation
  if (hyp && typeof hyp === "object") {
    const fromObj =
      firstString(hyp as AnyObj, [
        "financer",
        "financier",
        "financier_name",
        "financer_name",
        "financierName",
        "financerName",
        "bank_name",
        "bankName",
        "name",
      ]) ?? undefined
    if (fromObj) return fromObj
  }

  if (Array.isArray(hyp) && hyp.length) {
    for (const item of hyp) {
      if (item && typeof item === "object") {
        const fromItem =
          firstString(item as AnyObj, [
            "financer",
            "financier",
            "financier_name",
            "financer_name",
            "financierName",
            "financerName",
            "bank_name",
            "bankName",
            "name",
          ]) ?? undefined
        if (fromItem) return fromItem
      }
    }
  }

  return undefined
}

function extractFinancierFromSources(sources: AnyObj[]): string | undefined {
  for (const source of sources) {
    const value = extractFinancier(source)
    if (value) return value
  }
  return undefined
}

function joinNonEmpty(parts: Array<string | undefined | null>, separator = ", ") {
  return parts.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean).join(separator)
}

function normalizeDateString(value: string | undefined): string | undefined {
  const text = value?.trim()
  if (!text) return undefined

  // "YYYY-MM-DD..." or ISO timestamp: return as-is.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text
  if (/^\d{4}\/\d{2}\/\d{2}/.test(text)) return text.replace(/\//g, "-")

  // Compact "DDMMYYYY".
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(text)
  if (compact) return `${compact[3]}-${compact[2]}-${compact[1]}`

  // "MM/YYYY" -> "YYYY-MM-01" (common for manufacturing month/year).
  const monthYear = /^(\d{1,2})[\/-](\d{4})$/.exec(text)
  if (monthYear) {
    const mm = monthYear[1].padStart(2, "0")
    const yyyy = monthYear[2]
    return `${yyyy}-${mm}-01`
  }

  // Common Indian formats: "DD/MM/YYYY" or "DD-MM-YYYY" (optionally with time suffix).
  const match = /^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\D.*)?$/.exec(text)
  if (!match) return text
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

function formatDdMmYyyyIfPossible(value: string | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function formatAddress(value: any): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return coerceString(value)
  if (Array.isArray(value)) return coerceString(value)

  if (value && typeof value === "object") {
    const obj = value as AnyObj
    return joinNonEmpty([
      coerceString(obj.address_line1 ?? obj.addressLine1 ?? obj.line1),
      coerceString(obj.address_line2 ?? obj.addressLine2 ?? obj.line2),
      coerceString(obj.landmark),
      coerceString(obj.village),
      coerceString(obj.locality),
      coerceString(obj.city ?? obj.town),
      coerceString(obj.district),
      coerceString(obj.state),
      coerceString(obj.pincode ?? obj.pin_code ?? obj.pinCode ?? obj.zip),
    ])
  }

  return undefined
}

function deepFirstAddress(root: any): string | undefined {
  if (!root || typeof root !== "object") return undefined

  const keys = [
    "present_address",
    "presentAddress",
    "permanent_address",
    "permanentAddress",
    "address",
    "owner_address",
    "ownerAddress",
    "full_address",
    "fullAddress",
  ]
  const wanted = new Set(keys.map((k) => normalizeKey(k)))

  const seen = new Set<any>()
  const queue: Array<{ value: any; depth: number }> = [{ value: root, depth: 0 }]
  const maxDepth = 7
  let nodes = 0
  const maxNodes = 25000

  while (queue.length) {
    const { value, depth } = queue.shift()!
    if (!value || typeof value !== "object") continue
    if (seen.has(value)) continue
    seen.add(value)

    nodes++
    if (nodes > maxNodes) break

    if (!Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as AnyObj)) {
        if (!wanted.has(normalizeKey(key))) continue
        const candidate = formatAddress(child)
        if (candidate) return candidate
      }

      const candidate = formatAddress(value)
      if (candidate) return candidate
    }

    if (depth >= maxDepth) continue
    if (Array.isArray(value)) {
      for (const item of value) queue.push({ value: item, depth: depth + 1 })
    } else {
      for (const item of Object.values(value)) queue.push({ value: item, depth: depth + 1 })
    }
  }

  return undefined
}

function extractAddressFromSources(sources: AnyObj[]): string {
  const direct = firstStringFromSources(sources, [
    "present_address",
    "presentAddress",
    "permanent_address",
    "permanentAddress",
    "address",
    "owner_address",
    "ownerAddress",
    "full_address",
    "fullAddress",
  ])
  if (direct) return direct

  for (const source of sources) {
    const present = readValue(source, "present_address") ?? readValue(source, "presentAddress")
    const permanent = readValue(source, "permanent_address") ?? readValue(source, "permanentAddress")
    const address = readValue(source, "address") ?? readValue(source, "owner_address") ?? readValue(source, "ownerAddress")
    const fromObj = formatAddress(present) || formatAddress(permanent) || formatAddress(address)
    if (fromObj) return fromObj
  }

  return joinNonEmpty([
    firstStringFromSources(sources, ["address_line1", "addressLine1", "line1"]),
    firstStringFromSources(sources, ["address_line2", "addressLine2", "line2"]),
    firstStringFromSources(sources, ["landmark"]),
    firstStringFromSources(sources, ["city", "town", "district"]),
    firstStringFromSources(sources, ["state"]),
    firstStringFromSources(sources, ["pincode", "pin_code", "pinCode", "zip"]),
  ])
}

function computeRegistrationValidityFromRegDate(registrationDate: string | undefined): string | undefined {
  const iso = normalizeDateString(registrationDate)
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined

  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 15)
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(next)
}

function findDeepRcObject(root: AnyObj): AnyObj | null {
  const wantedKeys = [
    "rc_number",
    "rcNumber",
    "registration_number",
    "registrationNumber",
    "vrn",
    "reg_no",
    "regNo",
    "regn_no",
    "regnNo",
    "vehicle_number",
    "vehicleNumber",
    "owner_name",
    "ownerName",
    "owner",
    "chassis_number",
    "chassisNumber",
    "chassis_no",
    "chassisNo",
    "engine_number",
    "engineNumber",
    "engine_no",
    "engineNo",
    "registration_date",
    "registrationDate",
    "present_address",
    "presentAddress",
    "address",
    "maker_description",
    "makerDescription",
    "maker",
    "maker_model",
    "makerModel",
    "model",
    "fuel_type",
    "fuelType",
    "vehicle_color",
    "vehicleColor",
    "color",
    "body_type",
    "bodyType",
    "seating_capacity",
    "seatingCapacity",
  ]
  const wantedNorm = wantedKeys.map((k) => normalizeKey(k))

  const seen = new Set<any>()
  const queue: Array<{ value: any; depth: number }> = [{ value: root, depth: 0 }]
  let best: { obj: AnyObj; score: number } | null = null

  while (queue.length) {
    const { value, depth } = queue.shift()!
    if (!value || typeof value !== "object") continue
    if (seen.has(value)) continue
    seen.add(value)

    if (depth <= 5 && !Array.isArray(value)) {
      const index = getKeyIndex(value as AnyObj)
      let score = 0
      for (const key of wantedNorm) if (index.has(key)) score++
      if (score >= 2 && (!best || score > best.score)) best = { obj: value as AnyObj, score }
    }

    if (depth >= 5) continue

    if (Array.isArray(value)) {
      for (const item of value) queue.push({ value: item, depth: depth + 1 })
    } else {
      for (const child of Object.values(value)) queue.push({ value: child, depth: depth + 1 })
    }
  }

  return best?.obj ?? null
}

export function normalizeSurepassRcResponse(registrationNumber: string, raw: any): NormalizedRCData | null {
  const root: AnyObj = (raw && typeof raw === "object" ? raw : {}) as AnyObj
  const data: AnyObj =
    (root.data && typeof root.data === "object" ? root.data : null) ||
    (root.result && typeof root.result === "object" ? root.result : null) ||
    (root.response && typeof root.response === "object" ? root.response : null) ||
    (root.output && typeof root.output === "object" ? root.output : null) ||
    root

  // Sometimes responses are nested again: { data: { data: {...} } }
  const inner: AnyObj =
    (data.data && typeof data.data === "object" ? data.data : null) ||
    (data.rc && typeof data.rc === "object" ? data.rc : null) ||
    (data.result && typeof data.result === "object" ? data.result : null) ||
    (data.response && typeof data.response === "object" ? data.response : null) ||
    (data.output && typeof data.output === "object" ? data.output : null) ||
    (data.rc_details && typeof data.rc_details === "object" ? data.rc_details : null) ||
    (data.rcDetails && typeof data.rcDetails === "object" ? data.rcDetails : null) ||
    data

  const deepCandidate = findDeepRcObject(root)
  const candidate = deepCandidate ?? inner
  const sources = uniqueObjects([candidate, inner, data, root])

  const normalized: NormalizedRCData = {
    registrationNumber:
      firstStringFromSources(sources, [
        "rc_number",
        "rcNumber",
        "registration_number",
        "registrationNumber",
        "registration_no",
        "registrationNo",
        "id_number",
        "idNumber",
        "vrn",
        "reg_no",
        "regNo",
        "regn_number",
        "regnNumber",
        "regn_no",
        "regnNo",
        "vehicle_number",
        "vehicleNumber",
      ]) ||
      registrationNumber,
    ownerName: firstStringFromSources(sources, ["owner_name", "ownerName", "owner", "name"]) || "",
    vehicleClass:
      firstStringFromSources(sources, [
        "vehicle_category",
        "vehicleCategory",
        "vehicle_class",
        "vehicleClass",
        "vehicle_class_desc",
        "vehicleClassDesc",
        "vehicle_class_description",
        "vehicleClassDescription",
      ]) ||
      firstStringFromSources(sources, [
        "vehicle_category_description",
        "vehicleCategoryDescription",
        "vehicle_category_desc",
        "vehicleCategoryDesc",
      ]) ||
      "",
    maker: firstStringFromSources(sources, [
      "maker_description",
      "makerDescription",
      "maker",
      "make_description",
      "makeDescription",
      "manufacturer",
      "manufacturer_name",
      "manufacturerName",
      "manufacturer_description",
      "manufacturerDescription",
      "vehicle_manufacturer_name",
      "vehicleManufacturerName",
      "maker_name",
      "makerName",
      "vehicle_make",
      "vehicleMake",
      "make",
    ]) || "",
    model:
      firstStringFromSources(sources, [
        "maker_model",
        "makerModel",
        "model",
        "model_name",
        "modelName",
        "model_description",
        "modelDescription",
        "vehicle_model",
        "vehicleModel",
        "vehicle_model_description",
        "vehicleModelDescription",
        "vehicle_model_desc",
        "vehicleModelDesc",
        "variant",
      ]) || "",
    fuelType:
      firstStringFromSources(sources, [
        // APNIRC B2B returns fuel as `type`.
        "type",
        "fuel_type",
        "fuelType",
        "fuel",
        "fuel_desc",
        "fuel_description",
        "fuelDescription",
        "fuel_type_description",
        "fuelTypeDescription",
        "fuel_type_desc",
        "fuelTypeDesc",
        "vehicle_fuel_type",
        "vehicleFuelType",
        "vehicle_fuel_description",
        "vehicleFuelDescription",
        "vehicle_fuel_desc",
        "vehicleFuelDesc",
      ]) || "",
    registrationDate:
      normalizeDateString(
        firstStringFromSources(sources, [
          "registration_date",
          "registrationDate",
          "reg_date",
          "regDate",
          "date_of_registration",
          "date_of_reg",
          "dateOfReg",
        ]),
      ) || "",
    chassisNumber:
      firstStringFromSources(sources, [
        "vehicle_chasi_number",
      "vehicleChasiNumber",
      "vehicle_chassis_number",
      "vehicleChassisNumber",
      "chassis_number",
      "chassisNumber",
      "chassis_no",
      "chassisNo",
      "chassis",
    ]) || "",
    engineNumber:
      firstStringFromSources(sources, [
        "vehicle_engine_number",
        "vehicleEngineNumber",
        "engine_number",
        "engineNumber",
        "engine_no",
        "engineNo",
        "engine",
      ]) || "",
    address: extractAddressFromSources(sources),
    color: firstStringFromSources(sources, [
      "color",
      "colour",
      "vehicle_color",
      "vehicleColor",
      "vehicle_colour",
      "vehicleColour",
      "color_desc",
      "colorDesc",
      "colour_desc",
      "colourDesc",
    ]),
    bodyType: firstStringFromSources(sources, [
      "body_type",
      "bodyType",
      "body_type_desc",
      "bodyTypeDesc",
      "body_type_description",
      "bodyTypeDescription",
      "body_description",
      "bodyDescription",
    ]),
    seatingCapacity: firstStringFromSources(sources, [
      "seat_capacity",
      "seatCapacity",
      "seating_capacity",
      "seatingCapacity",
      "seat_cap",
      "seatCap",
      "seating_capacity_in_all",
      "seatingCapacityInAll",
      "seating_capacity_including_driver",
      "seatingCapacityIncludingDriver",
      "vehicle_seat_capacity",
      "vehicleSeatCapacity",
    ]),
    manufacturingDate: normalizeDateString(
      firstStringFromSources(sources, [
        "manufacturing_date_formatted",
        "manufacturingDateFormatted",
        "manufacturing_date",
        "manufacturingDate",
        "mfg_date",
        "mfgDate",
        "month_year_of_mfg",
        "monthYearOfMfg",
        "mfg_month_year",
        "mfgMonthYear",
      ]),
    ),
    cylinders: firstStringFromSources(sources, [
      "no_cylinders",
      "noCylinders",
      "cylinders",
      "no_of_cylinders",
      "noOfCylinders",
      "no_of_cylinder",
      "noOfCylinder",
      "vehicle_cylinders_no",
      "vehicleCylindersNo",
    ]),
    cubicCapacity: firstStringFromSources(sources, [
      "cubic_capacity",
      "cubicCapacity",
      "cubic_capacity_cc",
      "cubicCapacityCc",
      "engine_cc",
      "engineCc",
      "engine_capacity",
      "engineCapacity",
      "cc",
      "vehicle_cubic_capacity",
      "vehicleCubicCapacity",
    ]),
    horsePower: firstStringFromSources(sources, [
      "horse_power",
      "horsePower",
      "horse_power_bhp",
      "horsePowerBhp",
      "bhp",
      "hp",
      "power",
      "power_hp",
      "powerHp",
    ]),
    wheelBase: firstStringFromSources(sources, [
      "wheelbase",
      "wheelBase",
      "wheel_base",
      "wheel_base_mm",
      "wheelBaseMm",
    ]),
    financier: extractFinancierFromSources(sources),
    registrationAuthority: firstStringFromSources(sources, [
      "registered_at",
      "registeredAt",
      "registered_at_description",
      "registeredAtDescription",
      "rto_name",
      "rtoName",
      "rto_office",
      "rtoOffice",
      "rto_office_name",
      "rtoOfficeName",
      "registration_authority",
      "registrationAuthority",
      "reg_authority",
      "regAuthority",
      "registering_authority",
      "registeringAuthority",
      "rto",
      "rto_code",
      "rtoCode",
    ]),
    registrationValidity: normalizeDateString(
      firstStringFromSources(sources, [
        // APNIRC B2B
        "rc_expiry_date",
        "rcExpiryDate",
        "vehicle_tax_upto",
        "vehicleTaxUpto",
        "fit_up_to",
        "fitUpTo",
        "tax_upto",
        "taxUpto",
        "registration_validity",
        "registrationValidity",
        "reg_valid_upto",
        "regValidUpto",
        "registration_upto",
        "registrationUpto",
        "valid_upto",
        "validUpto",
        "validity_upto",
        "validityUpto",
      ]),
    ),
    emissionNorms: firstStringFromSources(sources, [
      "norms_type",
      "normsType",
      "norms_description",
      "normsDescription",
      "emission_norms",
      "emissionNorms",
      "emission_norms_desc",
      "emissionNormsDesc",
      "bs_norms",
      "bsNorms",
      "bs_norms_desc",
      "bsNormsDesc",
    ]),
    unladenWeight: firstStringFromSources(sources, [
      "unladen_weight",
      "unladenWeight",
      "unladen_weight_kg",
      "unladenWeightKg",
      "unladen_wt",
      "unladenWt",
      "weight_unladen",
      "weightUnladen",
    ]),
  }

  // Deep fallback for providers that nest values far away from the RC object we picked.
  if (!normalized.ownerName.trim()) normalized.ownerName = deepFirstString(root, ["owner_name", "ownerName", "owner", "name"]) || ""
  if (!normalized.vehicleClass.trim()) {
    normalized.vehicleClass =
      deepFirstString(root, [
        "vehicle_category",
        "vehicleCategory",
        "vehicle_class",
        "vehicleClass",
        "vehicle_class_desc",
        "vehicleClassDesc",
        "vehicle_class_description",
        "vehicleClassDescription",
      ]) || ""
  }
  if (!normalized.maker.trim()) {
    normalized.maker =
      deepFirstString(root, [
        "maker_description",
        "makerDescription",
        "maker",
        "make_description",
        "makeDescription",
        "maker_name",
        "makerName",
        "manufacturer",
        "manufacturer_name",
        "manufacturerName",
        "manufacturer_description",
        "manufacturerDescription",
        "vehicle_manufacturer_name",
        "vehicleManufacturerName",
        "vehicle_make",
        "vehicleMake",
        "make",
      ]) || ""
  }
  if (!normalized.model.trim()) {
    normalized.model =
      deepFirstString(root, [
        "maker_model",
        "makerModel",
        "model",
        "model_name",
        "modelName",
        "model_description",
        "modelDescription",
        "vehicle_model",
        "vehicleModel",
        "vehicle_model_description",
        "vehicleModelDescription",
        "vehicle_model_desc",
        "vehicleModelDesc",
        "variant",
      ]) || ""
  }
  if (!normalized.fuelType.trim()) {
    normalized.fuelType =
      deepFirstString(root, [
        "type",
        "fuel_type",
        "fuelType",
        "fuel",
        "fuel_desc",
        "fuel_description",
        "fuelDescription",
        "fuel_type_description",
        "fuelTypeDescription",
        "fuel_type_desc",
        "fuelTypeDesc",
        "vehicle_fuel_type",
        "vehicleFuelType",
        "vehicle_fuel_description",
        "vehicleFuelDescription",
        "vehicle_fuel_desc",
        "vehicleFuelDesc",
      ]) || ""
  }
  if (!normalized.registrationDate.trim()) {
    normalized.registrationDate =
      normalizeDateString(
        deepFirstString(root, [
          "registration_date",
          "registrationDate",
          "reg_date",
          "regDate",
          "date_of_registration",
          "date_of_reg",
          "dateOfReg",
        ]),
      ) || ""
  }
  if (!normalized.chassisNumber.trim()) {
    normalized.chassisNumber =
      deepFirstString(root, [
        "vehicle_chasi_number",
        "vehicleChasiNumber",
        "vehicle_chassis_number",
        "vehicleChassisNumber",
        "chassis_number",
        "chassisNumber",
        "chassis_no",
        "chassisNo",
        "chassis",
      ]) || ""
  }
  if (!normalized.engineNumber.trim()) {
    normalized.engineNumber =
      deepFirstString(root, [
        "vehicle_engine_number",
        "vehicleEngineNumber",
        "engine_number",
        "engineNumber",
        "engine_no",
        "engineNo",
        "engine",
      ]) || ""
  }
  if (!normalized.address.trim()) normalized.address = deepFirstAddress(root) || ""

  if (!normalized.color?.trim()) {
    normalized.color =
      deepFirstString(root, [
        "color",
        "colour",
        "vehicle_color",
        "vehicleColor",
        "vehicle_colour",
        "vehicleColour",
        "color_desc",
        "colorDesc",
        "colour_desc",
        "colourDesc",
      ]) || normalized.color
  }
  if (!normalized.bodyType?.trim()) {
    normalized.bodyType =
      deepFirstString(root, [
        "body_type",
        "bodyType",
        "body_type_desc",
        "bodyTypeDesc",
        "body_type_description",
        "bodyTypeDescription",
        "body_description",
        "bodyDescription",
      ]) || normalized.bodyType
  }
  if (!normalized.seatingCapacity?.trim()) {
    normalized.seatingCapacity =
      deepFirstString(root, [
        "seat_capacity",
        "seatCapacity",
        "seating_capacity",
        "seatingCapacity",
        "seat_cap",
        "seatCap",
        "seating_capacity_in_all",
        "seatingCapacityInAll",
        "seating_capacity_including_driver",
        "seatingCapacityIncludingDriver",
        "vehicle_seat_capacity",
        "vehicleSeatCapacity",
      ]) || normalized.seatingCapacity
  }
  if (!normalized.manufacturingDate?.trim()) {
    normalized.manufacturingDate =
      normalizeDateString(
        deepFirstString(root, [
          "manufacturing_date_formatted",
          "manufacturingDateFormatted",
          "manufacturing_date",
          "manufacturingDate",
          "mfg_date",
          "mfgDate",
          "month_year_of_mfg",
          "monthYearOfMfg",
          "mfg_month_year",
          "mfgMonthYear",
        ]),
      ) || normalized.manufacturingDate
  }
  if (!normalized.cylinders?.trim()) {
    normalized.cylinders =
      deepFirstString(root, [
        "no_cylinders",
        "noCylinders",
        "cylinders",
        "no_of_cylinders",
        "noOfCylinders",
        "no_of_cylinder",
        "noOfCylinder",
        "vehicle_cylinders_no",
        "vehicleCylindersNo",
      ]) || normalized.cylinders
  }
  if (!normalized.cubicCapacity?.trim()) {
    normalized.cubicCapacity =
      deepFirstString(root, [
        "cubic_capacity",
        "cubicCapacity",
        "cubic_capacity_cc",
        "cubicCapacityCc",
        "engine_cc",
        "engineCc",
        "engine_capacity",
        "engineCapacity",
        "cc",
        "vehicle_cubic_capacity",
        "vehicleCubicCapacity",
      ]) || normalized.cubicCapacity
  }
  if (!normalized.horsePower?.trim()) {
    normalized.horsePower =
      deepFirstString(root, ["horse_power", "horsePower", "horse_power_bhp", "horsePowerBhp", "bhp", "hp", "power", "power_hp", "powerHp"]) ||
      normalized.horsePower
  }
  if (!normalized.wheelBase?.trim()) {
    normalized.wheelBase =
      deepFirstString(root, ["wheelbase", "wheelBase", "wheel_base", "wheel_base_mm", "wheelBaseMm"]) || normalized.wheelBase
  }
  if (!normalized.unladenWeight?.trim()) {
    normalized.unladenWeight =
      deepFirstString(root, [
        "unladen_weight",
        "unladenWeight",
        "unladen_weight_kg",
        "unladenWeightKg",
        "unladen_wt",
        "unladenWt",
        "weight_unladen",
        "weightUnladen",
      ]) || normalized.unladenWeight
  }
  if (!normalized.emissionNorms?.trim()) {
    normalized.emissionNorms =
      deepFirstString(root, [
        "norms_type",
        "normsType",
        "norms_description",
        "normsDescription",
        "emission_norms",
        "emissionNorms",
        "emission_norms_desc",
        "emissionNormsDesc",
        "bs_norms",
        "bsNorms",
        "bs_norms_desc",
        "bsNormsDesc",
      ]) || normalized.emissionNorms
  }
  if (!normalized.financier?.trim()) {
    const candidate = deepFirstString(root, [
      "financer",
      "financier",
      "financier_name",
      "financer_name",
      "financierName",
      "financerName",
      "finance_company",
      "financeCompany",
      "bank_name",
      "bankName",
      "hypothecation",
    ])
    if (candidate && !looksLikeBooleanish(candidate)) normalized.financier = candidate
  }
  if (!normalized.registrationAuthority?.trim()) {
    normalized.registrationAuthority =
      deepFirstString(root, [
        "registered_at",
        "registeredAt",
        "registered_at_description",
        "registeredAtDescription",
        "rto_name",
        "rtoName",
        "rto_office",
        "rtoOffice",
        "rto_office_name",
        "rtoOfficeName",
        "registration_authority",
        "registrationAuthority",
        "reg_authority",
        "regAuthority",
        "registering_authority",
        "registeringAuthority",
        "rto",
        "rto_code",
        "rtoCode",
      ]) || normalized.registrationAuthority
  }
  if (!normalized.registrationValidity?.trim()) {
    normalized.registrationValidity =
      normalizeDateString(
        deepFirstString(root, [
          "rc_expiry_date",
          "rcExpiryDate",
          "vehicle_tax_upto",
          "vehicleTaxUpto",
          "fit_up_to",
          "fitUpTo",
          "tax_upto",
          "taxUpto",
          "registration_validity",
          "registrationValidity",
          "reg_valid_upto",
          "regValidUpto",
          "registration_upto",
          "registrationUpto",
          "valid_upto",
          "validUpto",
          "validity_upto",
          "validityUpto",
        ]),
      ) || normalized.registrationValidity
  }

  // If validity still missing, approximate (LMV/Car defaults to 15 years).
  if (!normalized.registrationValidity?.trim()) {
    normalized.registrationValidity = computeRegistrationValidityFromRegDate(normalized.registrationDate) ?? normalized.registrationValidity
  }

  // Template prints registration validity as-is; make it human-friendly if it's a date.
  normalized.registrationValidity = formatDdMmYyyyIfPossible(normalized.registrationValidity) ?? normalized.registrationValidity

  const unmasked = unmaskNormalizedRcData(registrationNumber, normalized)
  normalized.ownerName = unmasked.ownerName
  normalized.chassisNumber = unmasked.chassisNumber
  normalized.engineNumber = unmasked.engineNumber

  const hasMinimum =
    Boolean(normalized.registrationNumber) &&
    (Boolean(normalized.ownerName) ||
      Boolean(normalized.chassisNumber) ||
      Boolean(normalized.engineNumber) ||
      Boolean(normalized.registrationDate))

  return hasMinimum ? normalized : null
}
