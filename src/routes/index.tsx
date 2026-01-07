import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
  ssr: false
})

function Home() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AllTalk Book Reader App</h1>

      <div className="shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
        <p className="mb-4">
          Welcome to the AllTalk Book Reader application! This app allows you to paste text and have it read back to you
          paragraph by paragraph using the AllTalk TTS API.
        </p>
        <p className="mb-4">
          The app is designed to provide an audiobook-like experience by generating audio one paragraph at a time,
          preventing overload of the model with too much text.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <h2 className="text-blue-800 font-bold mb-2">Key Features</h2>
          <ul className="list-disc pl-5 text-blue-700 space-y-1">
            <li>Use any AllTalk server with easy configuration</li>
            <li>Select from all available TTS voices on the server</li>
            <li>Adjust speed, pitch, and language settings</li>
            <li>Automatic handling of text length limits (4096 characters)</li>
            <li>Paragraph-by-paragraph audio generation</li>
            <li>Visual progress tracking</li>
          </ul>
        </div>

        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
          <h2 className="text-green-800 font-bold mb-2">How to Use</h2>
          <ol className="list-decimal pl-5 text-green-700 space-y-1">
            <li>Configure your AllTalk server connection</li>
            <li>Paste your book text into the reader</li>
            <li>Choose your preferred voice and settings</li>
            <li>Process the text to split into paragraphs</li>
            <li>Use the playback controls to listen to your book</li>
            <li>Jump to any paragraph by clicking on it</li>
          </ol>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <h2 className="text-yellow-800 font-bold flex items-center mb-2">
          <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Important Note
        </h2>
        <p className="text-yellow-700">
          This application requires an AllTalk server to be running and understand how to use it. Make sure you have AllTalk installed and running on your machine or network. The default server address is <code className="bg-yellow-100 px-1 py-0.5 rounded">localhost:7851</code>.
          You can change this in the settings.
        </p>
      </div>

      <div className="text-center mt-8">
        <Link
          to="/reader"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition duration-200"
        >
          Go to Book Reader
        </Link>
      </div>
    </div>
  )
}
