"use client";

import { useState } from "react";

const EMOJI_BY_CATEGORY: Record<string, string[]> = {
  "😊 Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐"],
  "👍 Gestures": ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"],
  "❤️ Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️"],
  "📚 Study": ["📝", "✏️", "📚", "📖", "📕", "📗", "📘", "📙", "📓", "📔", "📒", "📋", "📁", "📂", "🗂️", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒", "🔓", "🔑", "🗝️", "🔨", "🪓", "⛏️", "⚒️", "🛠️", "🗡️", "⚔️", "🔱", "⚜️", "🏳️", "🏴"],
  "✅ Symbols": ["✅", "❌", "❓", "❗", "‼️", "⁉️", "💯", "🔅", "🔆", "⚡", "🔥", "⭐", "🌟", "✨", "💫", "🌈", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄", "🌬️", "💨", "💧", "💦", "☔", "☂️", "🌊", "🌫️"],
  "🎯 Objects": ["🎯", "🎲", "🎸", "🎹", "🎺", "🎻", "🪕", "🥁", "🪘", "🎷", "🎾", "🏀", "⚽", "🏈", "⚾", "🥎", "🎱", "🏉", "🎳", "🏓", "🪀", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤸", "⛹️", "🤾"],
  "🍎 Food": ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟"],
  "✈️ Travel": ["✈️", "🛫", "🛬", "🛩️", "💺", "🛰️", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓", "🪝", "⛽", "🚧", "🚦", "🚥", "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "⛺", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥"],
};

export function EmojiPicker({ onInsert }: { onInsert: (emoji: string) => void }) {
  const [category, setCategory] = useState<string>(Object.keys(EMOJI_BY_CATEGORY)[0]);
  const [open, setOpen] = useState(false);
  const emojis = EMOJI_BY_CATEGORY[category] ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-lg leading-none p-1.5 rounded hover:bg-ink/10 transition-colors"
        title="Insert emoji"
      >
        😀
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full mt-1 z-20 w-64 max-h-64 rounded-lg border border-ink/10 bg-white shadow-lg overflow-hidden">
            <div className="flex border-b border-ink/10 overflow-x-auto">
              {Object.keys(EMOJI_BY_CATEGORY).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${category === cat ? "bg-accent/20 text-accent" : "text-ink/60 hover:bg-ink/5"}`}
                >
                  {cat.split(" ")[0]}
                </button>
              ))}
            </div>
            <div className="p-2 max-h-44 overflow-y-auto grid grid-cols-8 gap-0.5">
              {emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onInsert(e)}
                  className="text-lg leading-none p-1 rounded hover:bg-ink/10 transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
