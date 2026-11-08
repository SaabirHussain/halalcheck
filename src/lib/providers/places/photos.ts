export function isValidPlacePhotoName(name: string) {
  return /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name);
}
