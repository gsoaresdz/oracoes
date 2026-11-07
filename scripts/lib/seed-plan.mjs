// Decide o que a importação deve gravar sem tocar no que já existe na conta.

/**
 * @param seed conteúdo de data/seed.json
 * @param existing { prayers: {title, body}[], routines: {weekday, is_base}[] }
 */
export function planSeed(seed, existing) {
  const current = new Map(existing.prayers.map((p) => [p.title, p.body]));
  const days = new Set(existing.routines.filter((r) => !r.is_base).map((r) => r.weekday));
  return {
    newPrayers: seed.prayers.filter((p) => !current.has(p.title)),
    // Títulos que já existem com outro texto: fica o da conta, que pode ter sido editado no app.
    keptPrayers: seed.prayers.filter((p) => current.has(p.title) && current.get(p.title) !== p.body).map((p) => p.title),
    createBase: !existing.routines.some((r) => r.is_base),
    newRoutines: seed.routines.filter((r) => !days.has(r.weekday)),
    skippedRoutines: seed.routines.filter((r) => days.has(r.weekday)).map((r) => r.name),
  };
}
