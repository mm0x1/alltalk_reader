import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="space-y-4 p-4 card my-8 max-w-lg mx-auto">
      <div className="text-gray-300">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="btn-secondary"
        >
          Go back
        </button>
        <Link
          to="/"
          className="btn-primary"
        >
          Start Over
        </Link>
      </p>
    </div>
  )
}
