'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWizardStore } from './wizard-store'

const STEPS = [
  { number: 1, label: 'Persona' },
  { number: 2, label: 'Padrao' },
  { number: 3, label: 'Tema' },
  { number: 4, label: 'Gerar' },
  { number: 5, label: 'Preview' },
  { number: 6, label: 'Agendar' },
]

function canAdvanceFrom(
  step: number,
  state: {
    persona: string | null
    pattern: string | null
    theme: string
    generatedContent: unknown
  }
): boolean {
  switch (step) {
    case 1:
      return state.persona !== null
    case 2:
      return state.pattern !== null
    case 3:
      return state.theme.trim().length > 0
    case 4:
      return state.generatedContent !== null
    case 5:
      return state.generatedContent !== null
    default:
      return false
  }
}

export function WizardStepper() {
  const currentStep = useWizardStore((s) => s.currentStep)
  const persona = useWizardStore((s) => s.persona)
  const pattern = useWizardStore((s) => s.pattern)
  const theme = useWizardStore((s) => s.theme)
  const generatedContent = useWizardStore((s) => s.generatedContent)
  const goToStep = useWizardStore((s) => s.goToStep)

  const canAdvance = canAdvanceFrom(currentStep, {
    persona,
    pattern,
    theme,
    generatedContent,
  })

  return (
    <nav aria-label="Progresso do wizard" className="w-full">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isActive = step.number === currentStep
          const isCompleted = step.number < currentStep
          const isClickable =
            step.number < currentStep ||
            (step.number === currentStep + 1 && canAdvance)

          return (
            <li key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToStep(step.number)}
                  disabled={!isClickable && !isActive}
                  aria-label={`Ir para ${step.label}`}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isActive &&
                      'border-primary bg-primary/10 text-primary',
                    !isActive &&
                      !isCompleted &&
                      'border-muted-foreground/30 text-muted-foreground/50',
                    isClickable
                      ? 'cursor-pointer hover:scale-110'
                      : 'cursor-not-allowed',
                    isActive && 'cursor-default'
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4" />
                  ) : (
                    step.number
                  )}
                </button>
                <span
                  className={cn(
                    'text-xs font-medium transition-colors duration-300',
                    isActive && 'text-foreground',
                    isCompleted && 'text-primary',
                    !isActive && !isCompleted && 'text-muted-foreground/50'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-6 h-px flex-1 transition-colors duration-300',
                    step.number < currentStep
                      ? 'bg-primary'
                      : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
