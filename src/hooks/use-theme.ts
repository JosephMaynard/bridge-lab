import { useEffect, useState } from "react"

type Theme = "light" | "dark"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("bridgelab-theme")
    if (saved === "light" || saved === "dark") return saved
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light"
    return "dark"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("bridgelab-theme", theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  }
}
