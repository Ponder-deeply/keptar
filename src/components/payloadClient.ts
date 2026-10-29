import { getPayload } from 'payload'

import config from '@/payload.config'

/** The Payload local API for server components and server actions. */
export const getPayloadClient = async () => getPayload({ config: await config })
