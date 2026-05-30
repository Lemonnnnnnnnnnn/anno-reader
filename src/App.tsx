import "./App.css";
import { ReaderLayout } from "./components/ReaderLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <ReaderLayout />
    </ErrorBoundary>
  );
}

export default App;
