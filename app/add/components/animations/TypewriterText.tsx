'use client'

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useState } from 'react'

interface TypewriterTextProps {
  /** The text to reveal character by character */
  text: string
  /** Delay between each character in milliseconds */
  charDelay?: number
  /** Initial delay before starting */
  startDelay?: number
  /** Callback when typing is complete */
  onComplete?: () => void
  /** Additional className */
  className?: string
  /** Whether to show a blinking cursor */
  showCursor?: boolean
  /** Cursor character */
  cursor?: string
}

/**
 * TypewriterText - Character-by-character text reveal
 *
 * Creates a meditative, deliberate text reveal that slows
 * the reader's pace and builds anticipation.
 */
export function TypewriterText({
  text,
  charDelay = 30,
  startDelay = 0,
  onComplete,
  className = '',
  showCursor = true,
  cursor = '|',
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const cursorControls = useAnimation()

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let currentIndex = 0

    const startTyping = () => {
      const typeNextChar = () => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
          timeoutId = setTimeout(typeNextChar, charDelay)
        } else {
          setIsComplete(true)
          onComplete?.()
        }
      }

      typeNextChar()
    }

    // Start after initial delay
    const startTimeoutId = setTimeout(startTyping, startDelay)

    return () => {
      clearTimeout(startTimeoutId)
      clearTimeout(timeoutId)
    }
  }, [text, charDelay, startDelay, onComplete])

  // Blink cursor when typing is complete
  useEffect(() => {
    if (isComplete && showCursor) {
      cursorControls.start({
        opacity: [1, 0, 1],
        transition: {
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.5, 1],
        },
      })
    }
  }, [isComplete, showCursor, cursorControls])

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <motion.span
          initial={{ opacity: 1 }}
          animate={cursorControls}
          className="ml-0.5"
        >
          {cursor}
        </motion.span>
      )}
    </span>
  )
}

/**
 * TypewriterParagraph - Multiple lines with staggered typewriter effect
 */
interface TypewriterParagraphProps {
  /** Array of lines to display */
  lines: string[]
  /** Delay between characters */
  charDelay?: number
  /** Delay between lines completing */
  lineDelay?: number
  /** Callback when all lines are complete */
  onComplete?: () => void
  /** ClassName for the container */
  className?: string
  /** ClassName for each line */
  lineClassName?: string
}

export function TypewriterParagraph({
  lines,
  charDelay = 30,
  lineDelay = 500,
  onComplete,
  className = '',
  lineClassName = '',
}: TypewriterParagraphProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [completedLines, setCompletedLines] = useState<string[]>([])

  const handleLineComplete = () => {
    if (currentLineIndex < lines.length - 1) {
      // Add current line to completed
      setCompletedLines(prev => [...prev, lines[currentLineIndex]])

      // Start next line after delay
      setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1)
      }, lineDelay)
    } else {
      // All lines complete
      setCompletedLines(prev => [...prev, lines[currentLineIndex]])
      onComplete?.()
    }
  }

  return (
    <div className={className}>
      {/* Already completed lines */}
      {completedLines.map((line, index) => (
        <p key={index} className={lineClassName}>
          {line}
        </p>
      ))}

      {/* Currently typing line */}
      {currentLineIndex < lines.length && completedLines.length === currentLineIndex && (
        <p className={lineClassName}>
          <TypewriterText
            text={lines[currentLineIndex]}
            charDelay={charDelay}
            onComplete={handleLineComplete}
            showCursor={currentLineIndex === lines.length - 1}
          />
        </p>
      )}
    </div>
  )
}

export default TypewriterText
