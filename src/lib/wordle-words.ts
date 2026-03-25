/**
 * Curated 5-letter English words for Wordle.
 * Suitable for language learners - common vocabulary.
 */
export const WORDLE_WORDS = [
  "about", "above", "after", "again", "agree", "allow", "alone", "along", "among", "angel",
  "anger", "angle", "angry", "apart", "apple", "apply", "arena", "argue", "arise", "array",
  "arrow", "aside", "avoid", "awake", "aware", "badly", "baker", "basic", "basis", "beach",
  "beard", "beast", "begin", "being", "below", "bench", "birth", "black", "blade", "blame",
  "blank", "blast", "bleed", "bless", "blind", "block", "blood", "board", "boast", "bonus",
  "boost", "bound", "brain", "brand", "brass", "brave", "bread", "break", "breed", "brick",
  "brief", "bring", "broad", "brown", "build", "burst", "buyer", "cabin", "cable", "cache",
  "candy", "carry", "catch", "cause", "chain", "chair", "chart", "chase", "cheap", "check",
  "chest", "chief", "child", "chill", "china", "claim", "class", "clean", "clear", "clerk",
  "click", "climb", "clock", "close", "cloud", "coach", "coast", "color", "comic", "coral",
  "costs", "could", "count", "court", "cover", "crack", "craft", "crash", "cream", "crime",
  "cross", "crowd", "crown", "curve", "cycle", "daily", "dance", "death", "delay", "delta",
  "dirty", "doubt", "draft", "drama", "dream", "dress", "drink", "drive", "drown", "eager",
  "early", "earth", "eight", "elder", "elect", "empty", "enemy", "enjoy", "enter", "equal",
  "error", "event", "every", "exact", "exist", "extra", "faith", "fancy", "fault", "favor",
  "fiber", "field", "fifth", "fifty", "fight", "final", "first", "fixed", "flash", "flood",
  "floor", "fluid", "focus", "force", "forest", "forge", "formal", "forth", "forty", "forum",
  "found", "frame", "fresh", "front", "fruit", "fully", "funny", "giant", "given", "glass",
  "globe", "glory", "grace", "grade", "grain", "grand", "grant", "grass", "great", "green",
  "grief", "gross", "group", "grown", "guard", "guess", "guest", "guide", "happy", "heart",
  "heavy", "hello", "hence", "horse", "hotel", "house", "human", "ideal", "image", "index",
  "inner", "input", "issue", "joint", "judge", "juice", "knife", "known", "label", "labor",
  "large", "later", "laugh", "layer", "learn", "least", "leave", "legal", "level", "light",
  "limit", "local", "logic", "loose", "loyal", "lucky", "lunch", "magic", "major", "maker",
  "march", "match", "maybe", "mayor", "media", "metal", "meter", "midst", "might", "minor",
  "minus", "mixed", "model", "money", "month", "moral", "motor", "mount", "mouse", "mouth",
  "movie", "music", "naked", "never", "night", "noise", "north", "novel", "nurse", "occur",
  "ocean", "offer", "often", "order", "other", "ought", "outer", "owner", "paint", "panel",
  "paper", "party", "pause", "peace", "phase", "phone", "photo", "piano", "piece", "pilot",
  "pitch", "place", "plain", "plane", "plant", "plate", "point", "pound", "power", "press",
  "price", "pride", "prime", "print", "prior", "prize", "proof", "proud", "prove", "queen",
  "quick", "quiet", "quite", "quote", "radio", "raise", "range", "rapid", "ratio", "reach",
  "ready", "refer", "right", "river", "robot", "rock", "round", "route", "royal", "rural",
  "scale", "scene", "scope", "score", "sense", "serve", "seven", "shall", "shape", "share",
  "sharp", "sheet", "shift", "shine", "shirt", "shock", "shoot", "short", "sight",
  "since", "skill", "sleep", "slide", "small", "smart", "smell", "smile", "smoke", "solid",
  "solve", "sorry", "sound", "south", "space", "spare", "speak", "speed", "spend", "spite",
  "split", "spoke", "sport", "staff", "stage", "stake", "stand", "start", "state", "steam",
  "steel", "stick", "still", "stock", "stone", "store", "storm", "story", "strip", "study",
  "stuff", "style", "sugar", "suite", "super", "sweet", "table", "taken", "taste", "teach",
  "tenth", "thank", "their", "theme", "there", "these", "thick", "thing", "think", "third",
  "those", "three", "throw", "tight", "times", "title", "today", "total", "touch", "tough",
  "tower", "trace", "track", "trade", "trail", "train", "treat", "trend", "trial", "tribe",
  "trick", "tried", "truck", "truly", "trust", "truth", "twice", "under", "union", "unity",
  "until", "upper", "urban", "usual", "valid", "value", "video", "virus", "visit", "vital",
  "voice", "voter", "waste", "watch", "water", "wheel", "where", "which", "while", "white",
  "whole", "whose", "woman", "world", "worry", "worth", "would", "wound", "write", "wrong",
  "young", "youth",
];

/**
 * Get the daily word for a given date (deterministic).
 * Uses a simple hash so the same date always returns the same word.
 */
export function getDailyWord(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % WORDLE_WORDS.length;
  return WORDLE_WORDS[index];
}
