import type { EmailAdapter } from 'payload'

/** Dev email adapter: prints the whole message (including links) to the server log. */
export const consoleEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'console',
  defaultFromAddress: 'no-reply@keptar.local',
  defaultFromName: 'Képtár (dev)',
  sendEmail: async (message) => {
    payload.logger.info(
      `\n--- email (not sent) ---\nTo: ${String(message.to)}\nSubject: ${message.subject}\n\n${message.text ?? message.html}\n------------------------`,
    )
  },
})
