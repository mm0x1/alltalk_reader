import { redirect, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect')({
  ssr: false,
  beforeLoad: async () => {
    throw redirect({
      to: '/reader',
    })
  },
})
