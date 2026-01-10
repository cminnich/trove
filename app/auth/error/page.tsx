import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Authentication Error
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          There was a problem signing you in. Please try again.
        </p>
        <Link
          href="/add"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  );
}
