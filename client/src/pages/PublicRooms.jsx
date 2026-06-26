import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";

const PublicRooms = () => {
  const [publicRooms, setPublicRooms] = useState([]);
  const [playerName, setPlayerName] = useState(
    sessionStorage.getItem("playerName") || "",
  );
  const [error, setError] = useState("");

  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedLeague =
    location.state?.selectedLeague || sessionStorage.getItem("selectedLeague") || "ipl";
  const roomTheme = {
    pageBg: "bg-[#0a0702]",
    glow: "from-[#D4AF37]/10 via-transparent to-transparent",
    card: "bg-[#120a02]/80 border-[#D4AF37]/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
    cardHover: "hover:bg-[#1a1205]/90 hover:border-[#D4AF37]/25",
    input: "bg-[#1a1205]/90 border-[#D4AF37]/20 focus:border-[#D4AF37]/60",
    textAccent: "text-[#FFE58F]",
    textAccentSoft: "text-[#D4AF37]",
    pill: "bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#FFE58F]",
    primaryBtn: "bg-gradient-to-r from-[#FFE58F] via-[#D4AF37] to-[#996515] text-[#1a1205] shadow-[0_8px_18px_rgba(212,175,55,0.25)]",
    secondaryBtn: "bg-[#1a1205] hover:bg-[#241607] border border-[#D4AF37]/20 text-[#D4AF37]/80 hover:text-[#FFE58F]",
  };

  useEffect(() => {
    sessionStorage.setItem("selectedLeague", selectedLeague);
  }, [selectedLeague]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomsUpdate = (rooms) => {
      const leagueRooms = (rooms || []).filter(
        (room) => (room.league || "ipl").toLowerCase() === selectedLeague,
      );
      setPublicRooms(leagueRooms);
    };

    socket.emit("fetch_public_rooms", { league: selectedLeague });
    socket.on("public_rooms_update", handleRoomsUpdate);

    return () => {
      socket.off("public_rooms_update", handleRoomsUpdate);
    };
  }, [socket, selectedLeague]);

  const handleJoin = (roomCode) => {
    if (!playerName) {
      setError("Please enter your name first!");
      return;
    }
    sessionStorage.setItem("playerName", playerName);
    navigate("/", { state: { autoJoinRoomCode: roomCode } });
  };

  const handleSpectate = (roomCode) => {
    if (!playerName) {
      setError("Please enter your name first!");
      return;
    }
    sessionStorage.setItem("playerName", playerName);
    navigate("/", { state: { autoSpectateRoomCode: roomCode } });
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden ${roomTheme.pageBg}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${roomTheme.glow} pointer-events-none`}></div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1a1205]/60 to-transparent pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-2xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 relative z-10 backdrop-blur-xl ${roomTheme.card}`}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className={`transition-colors flex items-center gap-2 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl ${roomTheme.secondaryBtn}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Lobby
          </button>
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest">
            Active <span className={roomTheme.textAccent}>Public Rooms</span>
          </h2>
        </div>

        <div className={`mb-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${roomTheme.pill}`}>
          Showing {selectedLeague.toUpperCase()} rooms only
        </div>

        <div className="space-y-4 mb-8 bg-[#1a1205]/70 p-6 rounded-2xl border border-[#D4AF37]/15">
          <label className="text-[10px] font-black text-[#D4AF37]/50 uppercase tracking-widest ml-1">
            The Gaffer's Name{" "}
            <span className="text-[#FFE58F] lowercase normal-case">
              (Required to Join)
            </span>
          </label>
          <input
            type="text"
            placeholder="Enter your name..."
            className={`w-full rounded-2xl px-6 py-4 focus:outline-none text-white font-bold transition-all mb-2 mt-2 border ${roomTheme.input}`}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          {error && (
            <p className="text-[#ff8f6b] text-[10px] font-black uppercase tracking-widest mt-1">
              {error}
            </p>
          )}
        </div>

        {publicRooms.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
            {publicRooms.map((room) => (
              <div
                key={room.roomCode}
                className={`flex items-center justify-between rounded-xl p-4 transition-colors border ${roomTheme.cardHover} ${roomTheme.card}`}
              >
                <div>
                  <div className="text-white font-bold text-base md:text-lg mb-1">
                    {room.hostName}'s Room
                  </div>
                  <div className="text-[#D4AF37]/55 text-[10px] font-bold uppercase tracking-widest">
                    <span
                      className={
                        room.teamsCount >= room.maxTeams
                          ? "text-[#ff8f6b]"
                          : "text-[#87d96c]"
                      }
                    >
                      {room.teamsCount} / {room.maxTeams}
                    </span>{" "}
                    Franchises Claimed
                  </div>
                  <div className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${roomTheme.pill}`}>
                    {String(room.league || "ipl").toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleJoin(room.roomCode)}
                    disabled={room.teamsCount >= room.maxTeams}
                    className={`px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wider uppercase transition-all ${room.teamsCount >= room.maxTeams ? "bg-[#241607] text-[#8b7355] cursor-not-allowed border border-[#D4AF37]/10" : roomTheme.primaryBtn}`}
                  >
                    {room.teamsCount >= room.maxTeams ? "Full" : "Join"}
                  </button>
                  <button
                    onClick={() => handleSpectate(room.roomCode)}
                    className={`px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wider uppercase transition-all ${roomTheme.secondaryBtn}`}
                  >
                    👁 Watch
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[#8b7355] text-[10px] font-bold uppercase tracking-widest bg-[#1a1205]/70 border border-[#D4AF37]/10 rounded-2xl">
            <div className="mb-4">
              <svg
                className="w-12 h-12 mx-auto text-[#8b7355]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            No public rooms currently active.
            <br />
            Head back and create one!
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PublicRooms;
