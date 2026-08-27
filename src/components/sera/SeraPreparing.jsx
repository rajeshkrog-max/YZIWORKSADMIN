import { useEffect, useState } from 'react'
import SeraOrb from './SeraOrb'

const LINES = ['Initializing…', 'Sera is reading your résumé…', 'Sera is getting ready…']

function SeraPreparing() {
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setLineIndex((prev) => (prev < LINES.length - 1 ? prev + 1 : prev))
    }, 1300)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-center text-center">
      <SeraOrb state="thinking" size={180} className="mb-6" />
      <p className="text-sm font-mono text-white/60 min-h-[20px]">{LINES[lineIndex]}</p>
    </div>
  )
}

export default SeraPreparing
