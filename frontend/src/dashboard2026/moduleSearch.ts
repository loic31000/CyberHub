import { categoryOf, type ModuleCategory } from "./environmentRegistry";

/*
 * One search logic for the global search (Ctrl+K) and both catalogues.
 *
 * Text is compared case- and accent-insensitively ("corrélation" finds
 * "Correlation", "ENQUETE" finds "enquête"); typographic apostrophes and
 * punctuation count as spaces. Every word of the query must be found; the
 * score prefers the name, then aliases, then the description and category.
 */

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`"«»().,;:!?/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Searchable = {
  title: string;
  description?: string;
  category?: ModuleCategory;
  keywords?: string[];
};

/* 0 when the item does not match; higher is better. */
export function searchScore(query: string, item: Searchable) {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return 1;
  const title = normalize(item.title);
  const keywords = (item.keywords ?? []).map(normalize);
  const category = item.category ? categoryOf(item.category) : null;
  const rest = normalize([item.description ?? "", category?.code ?? "", category?.label ?? ""].join(" "));
  let score = 0;
  for (const word of words) {
    const titleWords = title.split(" ");
    if (title.startsWith(word) || titleWords.some((w) => w.startsWith(word))) score += 8;
    else if (title.includes(word)) score += 5;
    else if (keywords.some((k) => k === word || k.split(" ").some((w) => w.startsWith(word)))) score += 4;
    else if (keywords.some((k) => k.includes(word))) score += 3;
    else if (rest.split(" ").some((w) => w.startsWith(word))) score += 2;
    else if (rest.includes(word)) score += 1;
    else return 0;
  }
  return score;
}

/* Matching items, best first; the original order breaks ties. */
export function searchItems<T extends Searchable>(query: string, items: T[]) {
  return items
    .map((item, index) => ({ item, index, score: searchScore(query, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
