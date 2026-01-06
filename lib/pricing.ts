export const REGISTERED_RC_DOWNLOAD_PRICE_INR = 18
export const GUEST_RC_DOWNLOAD_PRICE_INR = 22

export function getRcDownloadPriceInr(isGuest: boolean) {
  return isGuest ? GUEST_RC_DOWNLOAD_PRICE_INR : REGISTERED_RC_DOWNLOAD_PRICE_INR
}
