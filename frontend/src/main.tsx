// main.tsx
import React, { useRef } from 'react'
import ReactDOM from 'react-dom/client'
import Grid, { GridHandle } from '../map/grid' //
///////////////////////////////////////////////////////////////////////
import { runAgent } from '../IA/agent';
///////////////////////////////////////////////////////////////////////
const App = () => {
  const gridRef = useRef<GridHandle>(null); //
  const handleStartIA = () => {
    if (gridRef.current) {
      const map = gridRef.current.getMap(); //
      runAgent(gridRef);
      
      // Ici, envoyer la 'map' à backend Django si jamais je fais un db django x postgre
    }
  };

  return (
    <div style={{
      backgroundColor: "#000000",
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Oxanium, sans-serif',
    }}>
      {}
      <Grid ref={gridRef} onStart={handleStartIA} />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)