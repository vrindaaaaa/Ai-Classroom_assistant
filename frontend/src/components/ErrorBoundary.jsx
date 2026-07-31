import React, { Component } from "react";
import { AlertCircle } from "lucide-react";
import Button from "./Button";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Quiz Error Boundary caught an error:", error, errorInfo);
  }

  handleResume = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleBack = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onBack) {
      this.props.onBack();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-950">The quiz encountered an unexpected error.</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Something went wrong while loading the quiz. Your answers may still be saved.
          </p>
          <div className="flex gap-3">
            <Button variant="primary" onClick={this.handleResume} className="flex items-center gap-1">
              Resume Quiz
            </Button>
            <Button variant="outline" onClick={this.handleReload} className="flex items-center gap-1">
              Reload Question
            </Button>
            <Button variant="outline" onClick={this.handleBack} className="flex items-center gap-1">
              Return to Quiz List
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
