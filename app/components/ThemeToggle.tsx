'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" /> 

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-xl bg-gisviz-canvas hover:bg-gisviz-border text-gisviz-ink transition-all"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}