import DiffViewer from './components/DiffViewer';
import './App.css';
import type { ReactElement } from 'react';

function App(): ReactElement {
  return (
    <main className="app">
      <DiffViewer />
    </main>
  );
}

export default App;
