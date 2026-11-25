// pickCurrentSave — decide which save object governs a series-displacement
// prompt. The server is authoritative when it answers: an empty slot means
// the save was discarded and a stale cached copy must not resurrect it.
// The cache is a fallback only when the fetch itself failed.
export function pickCurrentSave(freshSave, remoteKnown, cachedSave) {
  return remoteKnown ? (freshSave || null) : (freshSave || cachedSave || null);
}
