import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import StatusCheck from './pages/StatusCheck';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/status" element={<StatusCheck />} />
    </Routes>
  );
}

export default App;
