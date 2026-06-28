'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import PhoneMockup from './phone-mockup'

export default function ProfilePreviewModal({ open, onOpenChange, slug, formState }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Profile Preview</DialogTitle>
          <DialogDescription>
            This is exactly what people see when they tap your card
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <PhoneMockup slug={slug} {...formState} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
