import { Link } from 'react-router-dom';
import { Shield, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-[#1A2E26]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-[#1E4334] flex items-center justify-center text-[#E5F3EB] mx-auto mb-6 shadow-sm">
          <Shield className="w-6 h-6" />
        </div>

        <span className="text-xs font-mono font-bold tracking-widest text-[#1E4334] uppercase bg-[#E5F3EB] px-2.5 py-1 rounded-md border border-[#A7D7BC]">
          HTTP 404 Not Found
        </span>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#1A2E26] mt-4 mb-3">
          Page does not exist
        </h1>

        <p className="text-xs text-[#4A5D53] max-w-sm mx-auto leading-relaxed mb-8">
          The requested URL, contract, or milestone document was not found or may have been relocated.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] transition-colors shadow-2xs"
          >
            <Home className="w-3.5 h-3.5" />
            Workspace Overview
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[#1A2E26] bg-white border border-[#D5CEC2] rounded-lg hover:bg-[#F5F2EB] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
