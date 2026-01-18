export const REGISTERED_RC_DOWNLOAD_PRICE_INR = 18
export const GUEST_RC_DOWNLOAD_PRICE_INR = 23

export const REGISTERED_RC_TO_MOBILE_PRICE_INR = 20
export const GUEST_RC_TO_MOBILE_PRICE_INR = 25

export const REGISTERED_RC_OWNER_HISTORY_PRICE_INR = 12
export const GUEST_RC_OWNER_HISTORY_PRICE_INR = 15

export const REGISTERED_PAN_DETAILS_PRICE_INR = 18
export const GUEST_PAN_DETAILS_PRICE_INR = 20
export const MIN_WALLET_RECHARGE_INR = 50

export function getRcDownloadPriceInr(isGuest: boolean) {
  return isGuest ? GUEST_RC_DOWNLOAD_PRICE_INR : REGISTERED_RC_DOWNLOAD_PRICE_INR
}

export function getRcToMobilePriceInr(isGuest: boolean) {
  return isGuest ? GUEST_RC_TO_MOBILE_PRICE_INR : REGISTERED_RC_TO_MOBILE_PRICE_INR
}

export function getRcOwnerHistoryPriceInr(isGuest: boolean) {
  return isGuest ? GUEST_RC_OWNER_HISTORY_PRICE_INR : REGISTERED_RC_OWNER_HISTORY_PRICE_INR
}

export function getPanDetailsPriceInr(isGuest: boolean) {
  return isGuest ? GUEST_PAN_DETAILS_PRICE_INR : REGISTERED_PAN_DETAILS_PRICE_INR
}
