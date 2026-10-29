import type { TaskConfig } from 'payload'

import { INQUIRY_RETENTION_MONTHS } from '../collections/Inquiries'

/** Deletes inquiries older than the retention period. Runs nightly (see payload.config.ts). */
export const purgeInquiries: TaskConfig<'purgeInquiries'> = {
  slug: 'purgeInquiries',
  label: 'Régi érdeklődések törlése',
  schedule: [{ cron: '0 0 3 * * *', queue: 'nightly' }],
  outputSchema: [{ name: 'deleted', type: 'number', required: true }],
  handler: async ({ req }) => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - INQUIRY_RETENTION_MONTHS)
    const result = await req.payload.delete({
      collection: 'inquiries',
      where: { createdAt: { less_than: cutoff.toISOString() } },
      overrideAccess: true,
      req,
    })
    return { output: { deleted: result.docs.length } }
  },
}
