/** English syllable estimate — a heuristic, so readability is labelled an estimate. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = stripped.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

export function readability(text: string): { fleschReadingEase: number | null; avgSentenceLength: number | null } {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3)
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  if (words.length < 100 || sentences.length < 3) return { fleschReadingEase: null, avgSentenceLength: null }
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0)
  const wps = words.length / sentences.length
  const spw = syllables / words.length
  const score = 206.835 - 1.015 * wps - 84.6 * spw
  return { fleschReadingEase: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10, avgSentenceLength: Math.round(wps * 10) / 10 }
}
