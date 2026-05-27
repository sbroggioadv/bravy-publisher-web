'use client'

import { Separator } from '@/components/ui/separator'
import { useWizardStore } from './wizard-store'
import { WizardStepper } from './wizard-stepper'
import { StepPersona } from './step-persona'
import { StepPattern } from './step-pattern'
import { StepTheme } from './step-theme'
import { StepGenerate } from './step-generate'
import { StepPreview } from './step-preview'
import { StepSchedule } from './step-schedule'

function CurrentStep() {
  const currentStep = useWizardStore((s) => s.currentStep)

  switch (currentStep) {
    case 1:
      return <StepPersona />
    case 2:
      return <StepPattern />
    case 3:
      return <StepTheme />
    case 4:
      return <StepGenerate />
    case 5:
      return <StepPreview />
    case 6:
      return <StepSchedule />
    default:
      return null
  }
}

export function WizardContainer() {
  return (
    <div className="space-y-8">
      <WizardStepper />

      <Separator />

      <div className="min-h-100">
        <CurrentStep />
      </div>
    </div>
  )
}
