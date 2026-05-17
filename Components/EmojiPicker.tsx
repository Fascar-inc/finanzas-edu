'use client'

import { useEffect, useRef, useState } from 'react'

// ── Emojis agrupados por categoría ────────────────────────────
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Finanzas',
    emojis: ['💰', '💵', '💳', '🏦', '💸', '🪙', '📊', '📈', '💹', '🧾', '🏧', '💼'],
  },
  {
    label: 'Comida',
    emojis: ['🛒', '🍕', '🍔', '🥗', '🍜', '☕', '🍺', '🥩', '🧃', '🍰', '🥦', '🥚'],
  },
  {
    label: 'Transporte',
    emojis: ['🚗', '🚌', '✈️', '🚲', '⛽', '🚇', '🛵', '🚕', '🛳️', '🚂', '🛺', '🏍️'],
  },
  {
    label: 'Hogar',
    emojis: ['🏠', '💡', '🔧', '🪴', '🛋️', '📺', '🧹', '🚿', '🛏️', '🪣', '🔑', '🏗️'],
  },
  {
    label: 'Salud',
    emojis: ['💊', '🏥', '💆', '🧴', '🩺', '🦷', '👓', '🩹', '🧬', '🏃', '🧘', '❤️'],
  },
  {
    label: 'Entretenimiento',
    emojis: ['🎮', '🎬', '🎵', '📚', '🎭', '🏋️', '⚽', '🎯', '🎪', '🎸', '🎨', '🃏'],
  },
  {
    label: 'Ropa',
    emojis: ['👗', '👟', '👒', '🧥', '👜', '💍', '🧦', '👔', '🕶️', '🧤', '👠', '🎒'],
  },
  {
    label: 'Tecnología',
    emojis: ['💻', '📱', '🖨️', '⌨️', '🖥️', '📷', '🎧', '🔋', '💾', '🖱️', '📡', '⌚'],
  },
  {
    label: 'Mascotas',
    emojis: ['🐶', '🐱', '🐾', '🦮', '🐠', '🐰', '🦜', '🐹', '🐢', '🍖', '🏡', '💉'],
  },
  {
    label: 'Otros',
    emojis: ['📦', '🎁', '🌱', '👶', '📝', '⭐', '🔔', '📌', '🗓️', '♻️', '🎓', '🙏'],
  },
]

// ── Props ─────────────────────────────────────────────────────
type Props = {
  value: string
  onChange: (emoji: string) => void
}

// ── Component ─────────────────────────────────────────────────
export default function EmojiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Cierra al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-12 h-10 flex items-center justify-center text-xl rounded-xl border transition-all
          ${open
            ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
          }`}
        title="Seleccionar emoji"
      >
        {value}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 top-12 left-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">

          {/* Tabs de grupo */}
          <div className="flex overflow-x-auto gap-0.5 p-2 border-b border-gray-100 scrollbar-none">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap
                  ${activeGroup === i
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Grid de emojis */}
          <div className="grid grid-cols-6 gap-0.5 p-2 max-h-44 overflow-y-auto">
            {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji)
                  setOpen(false)
                }}
                className={`text-xl h-10 w-10 flex items-center justify-center rounded-xl transition-all
                  ${value === emoji
                    ? 'bg-blue-100 ring-2 ring-blue-400 scale-110'
                    : 'hover:bg-gray-100 hover:scale-110'
                  }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Seleccionado: {value}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}