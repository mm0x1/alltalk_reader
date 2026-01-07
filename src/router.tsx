import * as React from 'react'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

// Using plain TanStack Router without React Query integration
// The routerWithQueryClient wrapper was causing SSR serialization errors
// with ReadableStream objects during dehydration.
// Since this app doesn't use React Query for data fetching anyway,
// we don't need the integration.

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    context: {},
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
  })
}

// Singleton router instance for TanStack Start
let routerInstance: ReturnType<typeof createRouter> | null = null

export function getRouter() {
  if (!routerInstance) {
    routerInstance = createRouter()
  }
  return routerInstance
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
