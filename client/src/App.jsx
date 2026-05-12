import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import StatusCheck from './pages/StatusCheck';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/status" element={<StatusCheck />} />
    </Routes>
  );
}

export default App;
