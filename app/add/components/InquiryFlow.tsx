'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { SocraticQuestion } from './SocraticQuestion'
import { TypewriterText, ProgressiveReveal, AmbientGlowBorder } from './animations'
import type {
  DialogueState,
  PlacementResult,
  SocraticQuestion as SocraticQuestionType,
} from '@/types/meditative-capture'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface InquiryFlowProps {
  /** The item being reflected upon */
  item: Item
  /** The placement result (collection + related items) */
  placement: PlacementResult
  /** Current dialogue state */
  dialogue: DialogueState
  /** Submit an answer to the current question */
  onSubmitAnswer: (answer: string) => void
  /** Skip the current question */
  onSkip: () => void
  /** Complete the inquiry phase */
  onComplete: () => void
}

/**
 * InquiryFlow - Socratic dialogue after seed placement
 *
 * Features:
 * - Deep zoom transition from Galaxy
 * - Collection theme background
 * - Typewriter effect questions
 * - Progressive reveal of UI elements
 * - Answer input (choice or open)
 */
export function InquiryFlow({
  item,
  placement,
  dialogue,
  onSubmitAnswer,
  onSkip,
  onComplete,
}: InquiryFlowProps) {
  const [showItem, setShowItem] = useState(false)
  const [showQuestion, setShowQuestion] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)

  const currentQuestion = dialogue.questions[dialogue.currentIndex]
  const isLastQuestion = dialogue.currentIndex === dialogue.questions.length - 1

  // Animation sequence
  useEffect(() => {
    // Show item after initial delay
    const itemTimer = setTimeout(() => setShowItem(true), 500)

    // Show question after item appears
    const questionTimer = setTimeout(() => setShowQuestion(true), 1500)

    return () => {
      clearTimeout(itemTimer)
      clearTimeout(questionTimer)
    }
  }, [])

  // Reset typing complete when question changes
  useEffect(() => {
    setTypingComplete(false)
  }, [dialogue.currentIndex])

  const handleAnswer = (answer: string) => {
    onSubmitAnswer(answer)

    // If last question, complete after a delay
    if (isLastQuestion) {
      setTimeout(() => onComplete(), 1000)
    } else {
      // Reset for next question
      setShowQuestion(false)
      setTimeout(() => setShowQuestion(true), 500)
    }
  }

  // Get theme colors from placement
  const [themeColor1, themeColor2] = getCollectionThemeColors(placement.collection.type)

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-6 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 30%, ${themeColor1} 0%, transparent 50%),
                     radial-gradient(ellipse at 50% 70%, ${themeColor2} 0%, var(--zen-void) 70%)`,
      }}
    >
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Collection name */}
      <ProgressiveReveal delay={0.2} className="mb-8">
        <span className="text-sm font-data text-zen-text-muted uppercase tracking-wider">
          {placement.collection.name}
        </span>
      </ProgressiveReveal>

      {/* Item preview */}
      <AnimatePresence>
        {showItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-8"
          >
            <AmbientGlowBorder
              theme="custom"
              customColors={[themeColor1, themeColor2]}
              borderRadius="1rem"
              className="w-32 h-32"
            >
              <div className="w-full h-full rounded-2xl overflow-hidden bg-zen-void-subtle">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.title || 'Item'}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl">📦</span>
                  </div>
                )}
              </div>
            </AmbientGlowBorder>

            {/* Item title */}
            <motion.p
              className="mt-4 text-center text-zen-text-reflective font-reflective text-lg max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {item.title || 'Untitled Item'}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current question */}
      <AnimatePresence mode="wait">
        {showQuestion && currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            {/* Question text with typewriter */}
            <div className="text-center mb-8">
              <p className="text-xl font-reflective text-zen-text-reflective leading-relaxed">
                <TypewriterText
                  text={currentQuestion.text}
                  charDelay={30}
                  onComplete={() => setTypingComplete(true)}
                  showCursor={!typingComplete}
                />
              </p>

              {/* Question context */}
              {currentQuestion.context && typingComplete && (
                <motion.p
                  className="mt-3 text-sm text-zen-text-muted font-data"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {currentQuestion.context}
                </motion.p>
              )}
            </div>

            {/* Answer input (appears after typing) */}
            <AnimatePresence>
              {typingComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <SocraticQuestion
                    question={currentQuestion}
                    onAnswer={handleAnswer}
                    onSkip={onSkip}
                    themeColors={[themeColor1, themeColor2]}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion state */}
      <AnimatePresence>
        {dialogue.isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  '0 0 20px rgba(34, 197, 94, 0.3)',
                  '0 0 40px rgba(34, 197, 94, 0.5)',
                  '0 0 20px rgba(34, 197, 94, 0.3)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <p className="text-zen-text-reflective font-reflective text-xl">
              Reflection complete
            </p>
            <p className="text-zen-text-muted text-sm mt-2 font-data">
              Your thoughts have been captured
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator */}
      {!dialogue.isComplete && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {dialogue.questions.map((_, i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < dialogue.currentIndex
                  ? 'bg-white/60'
                  : i === dialogue.currentIndex
                  ? 'bg-white'
                  : 'bg-white/20'
              }`}
              animate={i === dialogue.currentIndex ? {
                scale: [1, 1.2, 1],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      )}

      {/* Skip button */}
      {!dialogue.isComplete && typingComplete && (
        <button
          className="absolute bottom-8 right-8 text-zen-text-muted text-sm hover:text-zen-text-reflective transition-colors"
          onClick={onSkip}
        >
          Skip →
        </button>
      )}
    </div>
  )
}

/**
 * Get theme colors for a collection type
 */
function getCollectionThemeColors(type: string | null): [string, string] {
  switch (type) {
    case 'inbox':
      return ['rgba(99, 102, 241, 0.15)', 'rgba(139, 92, 246, 0.1)']
    case 'wishlist':
      return ['rgba(245, 158, 11, 0.15)', 'rgba(249, 115, 22, 0.1)']
    case 'inventory':
      return ['rgba(6, 182, 212, 0.15)', 'rgba(59, 130, 246, 0.1)']
    case 'research':
      return ['rgba(168, 85, 247, 0.15)', 'rgba(236, 72, 153, 0.1)']
    default:
      return ['rgba(107, 114, 128, 0.15)', 'rgba(156, 163, 175, 0.1)']
  }
}

export default InquiryFlow
