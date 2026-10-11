'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import PhoneMockup from './phone-mockup'

export default function ProfilePreviewModal({ open, onOpenChange, slug, formState }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Private draft preview</DialogTitle>
          <DialogDescription>
            Your current draft, including unsaved edits. Visitors see only your published revision. Scroll inside the preview to explore.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <PhoneMockup slug={slug} {...formState} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
