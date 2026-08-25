let residentPauseAuthorized = false;

/** Allow one in-session Back escape from the resident Merge chapter. */
export function authorizeResidentFtuePause() {
  residentPauseAuthorized = true;
}

/** A pause is never durable across backgrounding or a process restart. */
export function clearResidentFtuePause() {
  residentPauseAuthorized = false;
}

export function isResidentFtuePauseAuthorized() {
  return residentPauseAuthorized;
}
