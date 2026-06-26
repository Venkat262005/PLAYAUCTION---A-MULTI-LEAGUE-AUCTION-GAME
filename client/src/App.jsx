import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { SocketProvider } from "./context/SocketContext";
import Lobby from "./pages/Lobby";
import AuctionPodium from "./pages/AuctionPodium";
import QuizArena from "./pages/QuizArena";
import EvaluationLobby from "./pages/EvaluationLobby";
import ResultsReveal from "./pages/ResultsReveal";
import PublicRooms from "./pages/PublicRooms";

import ImmersiveWrapper from "./components/immersive/ImmersiveWrapper";
import { VoiceProvider } from "./context/VoiceContext";
import AdminLogin from "./pages/Admin/AdminLogin";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import { fetchLiveExchangeRates } from "./utils/playerUtils";

function App() {
  useEffect(() => {
    fetchLiveExchangeRates();
  }, []);

  return (
    <SessionProvider>
      <SocketProvider>
        <VoiceProvider>
          <Router>
            <ImmersiveWrapper>
              <Routes>
                <Route path="/" element={<Lobby />} />
                <Route path="/join/:roomCode" element={<Lobby />} />
                <Route path="/public-rooms" element={<PublicRooms />} />
                <Route path="/auction/:roomCode" element={<AuctionPodium />} />
                <Route path="/quiz/:roomCode" element={<QuizArena />} />
                <Route path="/evaluating/:roomCode" element={<EvaluationLobby />} />
                <Route path="/results/:roomCode" element={<ResultsReveal />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Routes>
            </ImmersiveWrapper>
          </Router>
        </VoiceProvider>
      </SocketProvider>
    </SessionProvider>
  );
}

export default App;
