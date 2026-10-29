import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '../lib/monitoring';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected client-side error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6 text-[#1A2E26]">
          <div className="max-w-md w-full bg-white rounded-xl border border-[#E5E0D8] p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h1 className="font-serif text-2xl font-semibold text-[#1A2E26] mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-[#4A5D53] mb-6 leading-relaxed">
              An unexpected error occurred while rendering this view. Diagnostic details have been safely logged for investigation without capturing personal details.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-[#1E4334] text-white hover:bg-[#163327] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border border-[#D5CEC2] bg-white text-[#1A2E26] hover:bg-[#F5F2EB] transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Return to Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
