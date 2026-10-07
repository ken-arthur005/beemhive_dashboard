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
          <DialogTitle>Private draft preview</DialogTitle>
          <DialogDescription>
            A preview of your current draft, including unsaved edits. Visitors see only your published revision. Layout may differ on the public page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <PhoneMockup slug={slug} {...formState} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
