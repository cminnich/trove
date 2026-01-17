'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import type { SocraticQuestion as SocraticQuestionType } from '@/types/meditative-capture'

interface SocraticQuestionProps {
  question: SocraticQuestionType
  onAnswer: (answer: string) => void
  onSkip: () => void
  themeColors?: [string, string]
}

/**
 * SocraticQuestion - Answer input for a single question
 *
 * Supports:
 * - Choice (multiple options)
 * - Open (text input)
 * - Scale (slider)
 */
export function SocraticQuestion({
  question,
  onAnswer,
  onSkip,
  themeColors = ['rgba(99, 102, 241, 0.5)', 'rgba(139, 92, 246, 0.5)'],
}: SocraticQuestionProps) {
  const [inputValue, setInputValue] = useState('')
  const [scaleValue, setScaleValue] = useState(50)

  const handleSubmit = () => {
    if (question.type === 'open') {
      if (inputValue.trim()) {
        onAnswer(inputValue.trim())
        setInputValue('')
      }
    } else if (question.type === 'scale') {
      onAnswer(`${scaleValue}`)
    }
  }

  // Choice question
  if (question.type === 'choice' && question.options) {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            className="px-5 py-2.5 rounded-full font-reflective text-zen-text-reflective
                       border border-white/20 hover:border-white/40
                       bg-white/5 hover:bg-white/10
                       transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAnswer(option)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {option}
          </motion.button>
        ))}
      </div>
    )
  }

  // Scale question
  if (question.type === 'scale') {
    const [minLabel, maxLabel] = question.scaleLabels || ['Low', 'High']

    return (
      <div className="w-full">
        <div className="flex justify-between text-sm text-zen-text-muted mb-3">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={scaleValue}
          onChange={(e) => setScaleValue(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer
                     bg-white/10 accent-white/80"
          style={{
            background: `linear-gradient(to right, ${themeColors[0]} 0%, ${themeColors[1]} ${scaleValue}%, rgba(255,255,255,0.1) ${scaleValue}%)`,
          }}
        />

        <motion.button
          className="mt-6 w-full py-3 rounded-xl font-reflective text-zen-text-reflective
                     border border-white/20 hover:border-white/40
                     bg-white/5 hover:bg-white/10
                     transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
        >
          Continue
        </motion.button>
      </div>
    )
  }

  // Open question (text input)
  return (
    <div className="w-full">
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Your thoughts..."
        className="w-full h-32 p-4 rounded-xl font-reflective text-zen-text-reflective
                   bg-white/5 border border-white/20 focus:border-white/40
                   placeholder-zen-text-muted/50
                   resize-none outline-none transition-colors"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />

      <div className="flex gap-3 mt-4">
        <motion.button
          className="flex-1 py-3 rounded-xl font-reflective text-zen-text-muted
                     border border-white/10 hover:border-white/20
                     bg-transparent hover:bg-white/5
                     transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSkip}
        >
          Skip
        </motion.button>

        <motion.button
          className="flex-1 py-3 rounded-xl font-reflective text-zen-text-reflective
                     border border-white/20 hover:border-white/40
                     bg-white/10 hover:bg-white/15
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}

export default SocraticQuestion
