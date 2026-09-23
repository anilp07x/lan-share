import type { FastifyInstance } from 'fastify'
import type { Store } from '../lib/store.ts'

export interface HistoryDeps {
  store: Store
  historyLimit: number
}

export async function historyRoutes(app: FastifyInstance, deps: HistoryDeps): Promise<void> {
  app.get('/api/history', async (req, reply) => {
    const query = req.query as { limit?: string }
    let limit = deps.historyLimit
    if (query.limit !== undefined) {
      const n = Number(query.limit)
      if (Number.isInteger(n) && n >= 1 && n <= 2000) limit = n
    }
    return reply.send({ messages: deps.store.recentMessages(limit) })
  })
}