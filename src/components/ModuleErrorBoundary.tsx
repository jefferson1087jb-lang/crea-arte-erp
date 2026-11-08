import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  children: ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Error inesperado al renderizar el módulo.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary - ${this.props.moduleName}]:`, error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-xl p-6 my-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Protección Activa en Módulo: {this.props.moduleName}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Se detectó una excepción aislada en esta vista. El resto del ERP y tus datos en
                bodega, órdenes y caja permanecen 100% seguros.
              </p>
              {this.state.errorMessage && (
                <div className="mt-2 p-2.5 rounded bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-rose-700 dark:text-rose-300 border border-slate-200 dark:border-slate-800">
                  Detalle técnico: {this.state.errorMessage}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar Carga del Módulo</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
