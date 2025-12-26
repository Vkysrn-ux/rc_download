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

function firstString(obj: AnyObj, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return undefined
}

function joinNonEmpty(parts: Array<string | undefined | null>, separator = ", ") {
  return parts.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean).join(separator)
}

function formatDdMmYyyyIfPossible(value: string | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

export function normalizeSurepassRcResponse(registrationNumber: string, raw: any): NormalizedRCData | null {
  const root: AnyObj = (raw && typeof raw === "object" ? raw : {}) as AnyObj
  const data: AnyObj =
    (root.data && typeof root.data === "object" ? root.data : null) ||
    (root.result && typeof root.result === "object" ? root.result : null) ||
    root

  // Sometimes responses are nested again: { data: { data: {...} } }
  const inner: AnyObj =
    (data.data && typeof data.data === "object" ? data.data : null) ||
    (data.rc && typeof data.rc === "object" ? data.rc : null) ||
    data

  const normalized: NormalizedRCData = {
    registrationNumber:
      firstString(inner, ["rc_number", "rcNumber", "registration_number", "registrationNumber", "id_number", "idNumber"]) ||
      registrationNumber,
    ownerName: firstString(inner, ["owner_name", "ownerName", "owner", "name"]) || "",
    vehicleClass:
      firstString(inner, ["vehicle_category", "vehicleCategory", "vehicle_class", "vehicleClass"]) ||
      firstString(inner, ["vehicle_category_description", "vehicleCategoryDescription"]) ||
      "",
    maker: firstString(inner, [
      "maker_description",
      "makerDescription",
      "maker",
      "manufacturer",
      "vehicle_make",
      "vehicleMake",
      "make",
    ]) || "",
    model: firstString(inner, ["maker_model", "makerModel", "model", "vehicle_model", "vehicleModel", "variant"]) || "",
    fuelType: firstString(inner, ["fuel_type", "fuelType", "fuel", "fuel_desc"]) || "",
    registrationDate:
      firstString(inner, ["registration_date", "registrationDate", "reg_date", "regDate", "date_of_registration"]) || "",
    chassisNumber: firstString(inner, [
      "vehicle_chasi_number",
      "vehicleChasiNumber",
      "vehicle_chassis_number",
      "vehicleChassisNumber",
      "chassis_number",
      "chassisNumber",
      "chassis_no",
      "chassisNo",
    ]) || "",
    engineNumber: firstString(inner, [
      "vehicle_engine_number",
      "vehicleEngineNumber",
      "engine_number",
      "engineNumber",
      "engine_no",
      "engineNo",
    ]) || "",
    address:
      firstString(inner, [
        "present_address",
        "presentAddress",
        "permanent_address",
        "permanentAddress",
        "address",
        "owner_address",
        "ownerAddress",
        "full_address",
        "fullAddress",
      ]) ||
      joinNonEmpty([
        firstString(inner, ["address_line1", "addressLine1"]),
        firstString(inner, ["address_line2", "addressLine2"]),
        firstString(inner, ["city"]),
        firstString(inner, ["state"]),
        firstString(inner, ["pincode", "pin_code", "zip"]),
      ]),
    color: firstString(inner, ["color", "vehicle_color", "vehicleColor"]),
    bodyType: firstString(inner, ["body_type", "bodyType"]),
    seatingCapacity: firstString(inner, ["seat_capacity", "seatCapacity", "seating_capacity", "seatingCapacity"]),
    manufacturingDate: firstString(inner, [
      "manufacturing_date_formatted",
      "manufacturingDateFormatted",
      "manufacturing_date",
      "manufacturingDate",
      "mfg_date",
      "mfgDate",
    ]),
    cylinders: firstString(inner, ["no_cylinders", "noCylinders", "cylinders", "no_of_cylinders", "noOfCylinders"]),
    cubicCapacity: firstString(inner, ["cubic_capacity", "cubicCapacity", "cc"]),
    horsePower: firstString(inner, ["horse_power", "horsePower", "hp"]),
    wheelBase: firstString(inner, ["wheelbase", "wheelBase", "wheel_base"]),
    financier: firstString(inner, ["financer", "financier", "hypothecation"]),
    registrationAuthority: firstString(inner, [
      "registered_at",
      "registeredAt",
      "registration_authority",
      "registrationAuthority",
      "rto",
    ]),
    registrationValidity: firstString(inner, [
      "fit_up_to",
      "fitUpTo",
      "tax_upto",
      "taxUpto",
      "registration_validity",
      "registrationValidity",
      "valid_upto",
      "validUpto",
    ]),
    emissionNorms: firstString(inner, [
      "norms_type",
      "normsType",
      "emission_norms",
      "emissionNorms",
      "bs_norms",
      "bsNorms",
    ]),
    unladenWeight: firstString(inner, ["unladen_weight", "unladenWeight"]),
  }

  // Template prints registration validity as-is; make it human-friendly if it's a date.
  normalized.registrationValidity = formatDdMmYyyyIfPossible(normalized.registrationValidity) ?? normalized.registrationValidity

  const hasMinimum =
    Boolean(normalized.registrationNumber) &&
    (Boolean(normalized.ownerName) ||
      Boolean(normalized.chassisNumber) ||
      Boolean(normalized.engineNumber) ||
      Boolean(normalized.registrationDate))

  return hasMinimum ? normalized : null
}
