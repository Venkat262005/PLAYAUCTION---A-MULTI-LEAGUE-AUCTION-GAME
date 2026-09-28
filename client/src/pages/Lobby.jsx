import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useSession } from "../context/SessionContext";
import { useVoice } from "../context/VoiceContext";
import {
  Copy, Check, Shield, Users, ArrowRight, Play, Settings,
  AlertTriangle, LogOut, Share2, Crown, Bot, Phone, Volume2,
  VolumeX, X, ChevronLeft, Plus, Hash, Eye, Lock, Globe, Cpu,
  Mic, Trophy, Star, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Toast from "../components/Toast";
import VoiceControls from "../components/VoiceControls";
import LeagueNewsMarquee from "../components/LeagueNewsMarquee";
import { fmtCr, LEAGUE_DEFAULTS } from "../utils/playerUtils";

// ─── Team Data ──────────────────────────────────────────────────────────────
const IPL_TEAMS = [
  { id: 'MI',   name: 'Mumbai Indians',           color: '#004BA0', logoUrl: '/ipl_logos/MI.png' },
  { id: 'CSK',  name: 'Chennai Super Kings',       color: '#FFFF3C', logoUrl: '/ipl_logos/CSK.png' },
  { id: 'RCB',  name: 'Royal Challengers Bengaluru', color: '#EC1C24', logoUrl: '/ipl_logos/RCB.png' },
  { id: 'KKR',  name: 'Kolkata Knight Riders',    color: '#2E0854', logoUrl: '/ipl_logos/KKR.png' },
  { id: 'DC',   name: 'Delhi Capitals',            color: '#00008B', logoUrl: '/ipl_logos/DC.png' },
  { id: 'PBKS', name: 'Punjab Kings',              color: '#ED1B24', logoUrl: '/ipl_logos/PBKS.png' },
  { id: 'RR',   name: 'Rajasthan Royals',          color: '#EA1A85', logoUrl: '/ipl_logos/RR.png' },
  { id: 'SRH',  name: 'Sunrisers Hyderabad',       color: '#FF822A', logoUrl: '/ipl_logos/SRH.png' },
  { id: 'LSG',  name: 'Lucknow Super Giants',      color: '#00D1FF', logoUrl: '/ipl_logos/LSG.png' },
  { id: 'GT',   name: 'Gujarat Titans',            color: '#1B2133', logoUrl: '/ipl_logos/GT.png' },
  { id: 'DCG',  name: 'Deccan Chargers',           color: '#D1E1EF', logoUrl: '/ipl_logos/DCG.png' },
  { id: 'KTK',  name: 'Kochi Tuskers Kerala',      color: '#F15A24', logoUrl: '/ipl_logos/KTK.png' },
  { id: 'PWI',  name: 'Pune Warriors India',       color: '#40E0D0', logoUrl: '/ipl_logos/PWI.png' },
  { id: 'RPS',  name: 'Rising Pune Supergiant',    color: '#D11D70', logoUrl: '/ipl_logos/RPS.png' },
  { id: 'GL',   name: 'Gujarat Lions',             color: '#E04F16', logoUrl: '/ipl_logos/GL.png' },
];

const WPL_TEAMS = [
  { id: 'MI',  name: 'Mumbai Indians',          color: '#004BA0', logoUrl: '/wpl_logos/MI.png' },
  { id: 'DC',  name: 'Delhi Capitals',          color: '#00008B', logoUrl: '/wpl_logos/DC.png' },
  { id: 'RCB', name: 'Royal Challengers Bangalore', color: '#EC1C24', logoUrl: '/wpl_logos/RCB.png' },
  { id: 'GG',  name: 'Gujarat Giants',          color: '#E9571E', logoUrl: '/wpl_logos/Gujarat_Giants_WPL_logo.svg.png' },
  { id: 'UPW', name: 'UP Warriorz',             color: '#FFFF00', logoUrl: '/wpl_logos/UP_Warriors(z)_WPL_logo.png' },
];

const SA20_TEAMS = [
  { id: 'DSG',  name: "Durban's Super Giants",    color: '#0A2240', logoUrl: "/sa20_logos/Durban's_Super_Giants_Logo.png" },
  { id: 'JSK',  name: 'Joburg Super Kings',       color: '#FFCC00', logoUrl: '/sa20_logos/Joburg_Super_Kings_Logo.png' },
  { id: 'MICT', name: 'MI Cape Town',             color: '#004BA0', logoUrl: '/sa20_logos/MI_Cape_Town_–_Logo.png' },
  { id: 'PR',   name: 'Paarl Royals',             color: '#DA1884', logoUrl: '/sa20_logos/Paarl_Royals_log0.png' },
  { id: 'PC',   name: 'Pretoria Capitals',        color: '#00A3E0', logoUrl: '/sa20_logos/Pretoria_Capitals_logo.png' },
  { id: 'SEC',  name: 'Sunrisers Eastern Cape',   color: '#F26522', logoUrl: '/sa20_logos/Sunrisers_Eastern_Cape_Logo.png' },
];

// ─── League Config ───────────────────────────────────────────────────────────
const LEAGUES = {
  ipl: {
    id: 'ipl',
    label: 'IPL',
    subtitle: 'Indian Premier League',
    description: 'Men\'s cricket. 15 teams. ₹120Cr budget.',
    logoUrl: '/ipl_logos/ipl-logo.png',
    accent: '#D4AF37',
    accentLight: '#FFE58F',
    accentDim: 'rgba(212,175,55,0.15)',
    borderColor: 'border-[#D4AF37]/40',
    btnPrimary: 'bg-gradient-to-r from-[#D4AF37] to-[#FFE58F] text-[#1a1205]',
    badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30',
    glowColor: 'shadow-[0_0_30px_rgba(212,175,55,0.2)]',
    focusClass: 'focus:border-[#D4AF37]/60',
    tabActiveClass: 'bg-[#D4AF37] text-[#1a1205]',
    rules: { squad: '18–25 Players', overseas: 'Max 8', bowling: 'Min 5', keeping: 'Min 2' },
  },
  wpl: {
    id: 'wpl',
    label: 'WPL',
    subtitle: "Women's Premier League",
    description: 'Women\'s cricket. 5 teams. ₹15Cr budget.',
    logoUrl: '/wpl_logos/wpl logo.svg',
    accent: '#ec4899',
    accentLight: '#f9a8d4',
    accentDim: 'rgba(236,72,153,0.15)',
    borderColor: 'border-pink-500/40',
    btnPrimary: 'bg-gradient-to-r from-pink-500 to-pink-400 text-white',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(236,72,153,0.2)]',
    focusClass: 'focus:border-pink-500/60',
    tabActiveClass: 'bg-pink-500 text-white',
    rules: { squad: '15–18 Players', overseas: 'Max 8', bowling: 'Min 4', keeping: 'Min 2' },
  },
  sa20: {
    id: 'sa20',
    label: 'SA20',
    subtitle: 'SA20 League',
    description: 'South African cricket. 6 teams. R41M budget.',
    logoUrl: '/sa20_logos/SA20Logo.png',
    accent: '#06B6D4',
    accentLight: '#67e8f9',
    accentDim: 'rgba(6,182,212,0.15)',
    borderColor: 'border-cyan-500/40',
    btnPrimary: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(6,182,212,0.2)]',
    focusClass: 'focus:border-cyan-500/60',
    tabActiveClass: 'bg-cyan-500 text-white',
    rules: { squad: '15–20 Players', overseas: 'Max 7', domestic: 'Min 10 South African', uncapped: 'Min 2 Uncapped', keeping: 'Min 2', bowling: 'Min 3' },
  },
};

// ─── Retention Constants ──────────────────────────────────────────────────────
const LEAGUE_YEARS = {
  wpl: ['2023', '2024', '2025', '2026'],
  sa20: ['2023', '2024', '2025', '2026'],
};

const LEAGUE_FIRST_YEAR = {
  wpl: '2023',
  sa20: '2023',
};

const RETENTION_RULES = {
  wpl: { maxCapped: 3, maxUncapped: 1, maxTotal: 4, cappedCosts: [350, 250, 250], uncappedCost: 50 },
  sa20: { maxCapped: 4, maxUncapped: 1, maxTotal: 5, cappedCosts: [90, 70, 45, 35], uncappedCost: 5 },
};

// ─── Lobby Component ─────────────────────────────────────────────────────────
const Lobby = () => {
  const [selectedLeague, setSelectedLeague] = useState("ipl");
  const { playerName, userId, initSession } = useSession();
  const { isJoined: isVoiceJoined, leaveVoice, voiceParticipants } = useVoice();
  const [localNameInput, setLocalNameInput] = useState(playerName || "");

  useEffect(() => {
    if (playerName && !localNameInput) setLocalNameInput(playerName);
  }, [playerName]);

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [timerDuration, setTimerDuration] = useState(10);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [joinMode, setJoinMode] = useState(false);
  const [availableTeamsForRoom, setAvailableTeamsForRoom] = useState(null);
  const [presignedByTeam, setPresignedByTeam] = useState({});
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);
  const [spectators, setSpectators] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [onlineMap, setOnlineMap] = useState({});
  const [coHostUserIds, setCoHostUserIds] = useState([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [creatingRoomType, setCreatingRoomType] = useState("private");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [isDirectJoining, setIsDirectJoining] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [localLobbySettings, setLocalLobbySettings] = useState({ allowSpectators: true, maxSpectators: 10, teamCount: 15 });
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  // Retention State
  const [selectedYear, setSelectedYear] = useState(null);
  const [myTeamRetentionSquad, setMyTeamRetentionSquad] = useState(null);
  const [myRetentions, setMyRetentions] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [lobbyRetentionStatus, setLobbyRetentionStatus] = useState({});
  const [lobbyCustomPrices, setLobbyCustomPrices] = useState({});
  const [retentionsModalTeam, setRetentionsModalTeam] = useState(null);

  const { socket, reconnectWithToken } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode: urlRoomCode } = useParams();
  const [lobbyStep, setLobbyStep] = useState(urlRoomCode ? "setup" : "league");

  const league = LEAGUES[selectedLeague] || LEAGUES.ipl;

  useEffect(() => {
    setSelectedCurrency("");
  }, [selectedLeague]);

  useEffect(() => {
    sessionStorage.setItem("selectedLeague", selectedLeague);
  }, [selectedLeague]);

  // ── Action Handlers ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!localNameInput.trim()) return setToast({ message: "Please enter your name first", type: "warning" });
    try {
      setIsAutoJoining(true);
      const data = await initSession(localNameInput.trim());
      const freshSocket = await reconnectWithToken(data.token);
      const defaultCurrency = selectedLeague === 'sa20' ? 'zar' : 'inr';
      freshSocket.emit("create_room", { 
        roomType: creatingRoomType, 
        league: selectedLeague,
        currency: selectedCurrency || defaultCurrency,
        auctionYear: selectedYear
      });
    } catch (e) {
      setError(e.message || 'Failed to create room');
      setIsAutoJoining(false);
    }
  };

  const handleJoin = async (codeToJoin = roomCodeInput, nameOverride = null) => {
    const finalName = nameOverride || localNameInput;
    if (!finalName.trim() || !codeToJoin)
      return setToast({ message: "Name and Room Code required", type: "warning" });
    try {
      setIsAutoJoining(true);
      const data = await initSession(finalName.trim());
      const freshSocket = await reconnectWithToken(data.token);
      freshSocket.emit("join_room", { roomCode: codeToJoin });
    } catch (e) {
      setError(e.message || 'Failed to join room');
      setIsAutoJoining(false);
    }
  };

  const handleSpectate = async (codeToJoin = roomCodeInput) => {
    if (!localNameInput.trim() || !codeToJoin) return setError("Name and Room Code required");
    try {
      setIsAutoJoining(true);
      const data = await initSession(localNameInput.trim());
      const freshSocket = await reconnectWithToken(data.token);
      freshSocket.emit("join_room", { roomCode: codeToJoin, asSpectator: true });
    } catch (e) {
      setError(e.message || 'Failed to join');
      setIsAutoJoining(false);
    }
  };

  const handleClaimTeam = () => {
    if (!selectedTeamId) return setToast({ message: "Please pick a team first", type: "warning" });
    socket.emit("claim_team", { roomCode: roomState?.roomCode, teamId: selectedTeamId });
  };

  const handleStart = () => {
    if ((roomState?.teams?.length || 0) < 3) {
      setToast({ message: "At least 3 players (claimed franchises) are required to start the auction room.", type: "warning" });
      return;
    }
    socket.emit("start_auction", { roomCode: roomState.roomCode });
  };

  const handleRequestAccess = () => {
    if (!roomCodeInput) return;
    socket.emit("request_participation", { roomCode: roomCodeInput });
    setIsPendingApproval(true);
    setError("");
  };

  // ── URL / Auto-join Hooks ────────────────────────────────────────────────
  useEffect(() => {
    if (urlRoomCode) {
      const code = urlRoomCode.toUpperCase();
      setRoomCodeInput(code);
      setIsDirectJoining(true);
      setLobbyStep("setup");

      // Fetch room details to set the correct league on the invite screen
      const apiUrl = import.meta.env.VITE_API_URL || "";
      fetch(`${apiUrl}/api/room/${code}`)
        .then((res) => {
          if (!res.ok) throw new Error("Room not found");
          return res.json();
        })
        .then((room) => {
          if (room && room.league) {
            setSelectedLeague(room.league.toLowerCase());
            console.log(`[LOBBY] Invite room details loaded. Setting league to: ${room.league}`);
          }
        })
        .catch((err) => {
          console.warn("[LOBBY] Failed to fetch room details for invite link:", err.message);
        });
    } else {
      setIsDirectJoining(false);
    }
  }, [urlRoomCode]);

  const handleCopyLink = () => {
    if (!roomState?.roomCode) return;
    const link = `${window.location.protocol}//${window.location.host}/join/${roomState.roomCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsapp = () => {
    if (!roomState?.roomCode) return;
    const link = `${window.location.protocol}//${window.location.host}/join/${roomState.roomCode}`;
    const text = `Join my auction room!\n\nClick to join: ${link}\n\nOr open the site and enter Room Code: ${roomState.roomCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    if (location.state?.autoJoinRoomCode && playerName && socket) {
      socket.emit("join_room", { roomCode: location.state.autoJoinRoomCode });
      navigate("/", { replace: true, state: {} });
    }
    if (location.state?.autoSpectateRoomCode && playerName && socket) {
      socket.emit("join_room", { roomCode: location.state.autoSpectateRoomCode, asSpectator: true });
      navigate("/", { replace: true, state: {} });
    }
  }, [location.state, playerName, socket, navigate]);

  useEffect(() => {
    if (urlRoomCode && playerName && socket && !isJoined && !isAutoJoining) {
      handleJoin(urlRoomCode.toUpperCase(), playerName);
    }
  }, [urlRoomCode, playerName, socket, isJoined, isAutoJoining]);

  // ── Socket Events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("room_created", ({ roomCode, state }) => {
      setRoomState(state);
      setIsJoined(true);
      setError("");
      if (location.pathname !== `/join/${roomCode}`) navigate(`/join/${roomCode}`, { replace: true });
    });

    socket.on("room_joined", ({ state }) => {
      const roomCode = state.roomCode;
      setRoomState(state);
      setIsJoined(true);
      setError("");
      setIsAutoJoining(false);
      setCoHostUserIds(state.coHostUserIds || []);
      const amSpectator = state.spectators?.some((s) => s.socketId === socket.id);
      setIsSpectatorMode(amSpectator || false);
      setSelectedYear(state.auctionYear || null);
      if (state.retentionsByTeam) {
        setLobbyRetentionStatus(state.retentionsByTeam);
      }
      if (state.customPricesByTeam) {
        setLobbyCustomPrices(state.customPricesByTeam);
      }
      if (state.status === "Lobby" && location.pathname !== `/join/${roomCode}`) {
        navigate(`/join/${roomCode}`, { replace: true });
      }
      if (state.status === "Auctioning" || state.status === "Paused") {
        navigate(`/auction/${roomCode}`, { state: { roomState: state, isSpectator: amSpectator || false } });
      }
    });

    socket.on("lobby_update", ({ teams }) => setRoomState((prev) => prev ? { ...prev, teams } : null));
    socket.on("available_teams", ({ teams, presignedByTeam: pbt }) => {
      setAvailableTeamsForRoom(teams);
      if (pbt && Object.keys(pbt).length > 0) setPresignedByTeam(pbt);
      setError("");
    });
    socket.on("spectator_update", ({ spectators }) => {
      setSpectators(spectators);
      const amSpectator = spectators?.some((s) => s.socketId === socket?.id);
      setIsSpectatorMode(amSpectator || false);
    });
    socket.on("join_requests_update", ({ roomCode: updatedRoomCode, requests }) => {
      const currentRoomCode = roomState?.roomCode;
      if (updatedRoomCode && currentRoomCode && updatedRoomCode !== currentRoomCode) return;
      setJoinRequests(requests);
    });
    socket.on("cohosts_updated", ({ coHostUserIds }) => {
      setCoHostUserIds(coHostUserIds);
      setRoomState(prev => prev ? { ...prev, coHostUserIds } : null);
    });
    socket.on("player_status_update", ({ onlineMap }) => setOnlineMap((prev) => ({ ...prev, ...onlineMap })));
    socket.on("room_disbanded", () => {
      setIsJoined(false); setRoomState(null); setSelectedTeamId(""); setShowLeaveConfirm(false);
      setSelectedYear(null); setMyTeamRetentionSquad(null); setMyRetentions([]); setCustomPrices({});
      setRetentionConfirmed(false); setLobbyRetentionStatus({});
      setError("The host has ended this room.");
    });
    socket.on("error", (msg) => { setError(msg); setIsAutoJoining(false); });
    socket.on("name_taken", ({ message }) => { setError(message || 'This name is already taken in this room.'); setIsAutoJoining(false); });
    socket.on("auction_started", ({ state }) => navigate(`/auction/${state.roomCode}`, { state: { roomState: state, isSpectator: isSpectatorMode } }));
    socket.on("kicked_from_room", () => { setIsJoined(false); setRoomState(null); setError("You have been removed from the room."); });
    socket.on("settings_updated", ({ timerDuration }) => setTimerDuration(timerDuration));
    socket.on("lobby_settings_updated", (settings) => { setLocalLobbySettings(settings); setRoomState(prev => prev ? { ...prev, ...settings } : null); });
    socket.on("participation_approved", () => { setIsPendingApproval(false); handleSpectate(roomCodeInput); });
    socket.on("participation_rejected", () => { setIsPendingApproval(false); setError("Your request to watch was declined by the host."); });

    socket.on("my_team_retention_squad", ({ squad, auctionYear, league }) => {
      setMyTeamRetentionSquad(squad);
      setRetentionConfirmed(false);
      setMyRetentions([]);
      setCustomPrices({});
    });
    socket.on("retentions_confirmed", ({ teamName, retentionDetails, totalCost }) => {
      setRetentionConfirmed(true);
      setToast({ message: `Retentions submitted successfully!`, type: "success" });
    });
    socket.on("lobby_retention_update", ({ retentionStatus, customPricesByTeam }) => {
      setLobbyRetentionStatus(retentionStatus || {});
      if (customPricesByTeam) {
        setLobbyCustomPrices(customPricesByTeam);
      }
    });
    socket.on("retentions_already_submitted", ({ retainedPlayers, customPrices: savedPrices }) => {
      setRetentionConfirmed(true);
      setMyRetentions(retainedPlayers || []);
      setCustomPrices(savedPrices || {});
    });

    return () => {
      socket.off("room_created"); socket.off("room_joined"); socket.off("lobby_update");
      socket.off("available_teams"); socket.off("error"); socket.off("kicked_from_room");
      socket.off("room_disbanded"); socket.off("spectator_update"); socket.off("join_requests_update");
      socket.off("player_status_update"); socket.off("cohosts_updated"); socket.off("name_taken");
      socket.off("connect");
      socket.off("my_team_retention_squad");
      socket.off("retentions_confirmed");
      socket.off("lobby_retention_update");
      socket.off("retentions_already_submitted");
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (!socket || !roomState?.roomCode) return;
    const onReconnect = () => socket.emit("join_room", { roomCode: roomState.roomCode, asSpectator: isSpectatorMode });
    socket.on("connect", onReconnect);
    return () => socket.off("connect", onReconnect);
  }, [socket, roomState?.roomCode, isSpectatorMode]);

  const handleToggleCoHost = (targetUserId) => socket.emit("toggle_cohost", { roomCode: roomState.roomCode, userId: targetUserId });

  const handleLeaveRoom = () => setShowLeaveConfirm(true);
  const confirmLeaveRoom = () => {
    if (isVoiceJoined && roomState?.roomCode) leaveVoice(roomState.roomCode);
    if (roomState?.roomCode) socket.emit("leave_room", { roomCode: roomState.roomCode });
    setIsJoined(false); setRoomState(null); setSelectedTeamId(""); setError("");
    setShowLeaveConfirm(false); setIsSpectatorMode(false); setIsEditingName(false); setShowSettings(false);
    setSelectedYear(null); setMyTeamRetentionSquad(null); setMyRetentions([]); setCustomPrices({});
    setRetentionConfirmed(false); setLobbyRetentionStatus({});
  };

  const handleChangeName = () => {
    if (!tempName.trim()) return;
    socket.emit("change_owner_name", { roomCode: roomState.roomCode, newName: tempName.trim() });
    setIsEditingName(false);
  };

  const handleUpdateLobbySettings = () => {
    socket.emit("update_lobby_settings", { roomCode: roomState.roomCode, ...localLobbySettings });
    setShowSettings(false);
  };

  const toggleRetainedPlayer = (playerName) => {
    const rules = RETENTION_RULES[activeLeague] || RETENTION_RULES.ipl;
    const isAlreadySelected = myRetentions.includes(playerName);

    if (isAlreadySelected) {
      setMyRetentions(prev => prev.filter(name => name !== playerName));
      setCustomPrices(prev => {
        const next = { ...prev };
        delete next[playerName];
        return next;
      });
    } else {
      const playerObj = myTeamRetentionSquad?.find(p => p.name === playerName);
      const isUncapped = !!playerObj?.isUncapped;
      const isOverseas = !!playerObj?.isOverseas;

      const currentlyCapped = myRetentions.filter(name => {
        const p = myTeamRetentionSquad?.find(x => x.name === name);
        return !p?.isUncapped;
      });
      const currentlyUncapped = myRetentions.filter(name => {
        const p = myTeamRetentionSquad?.find(x => x.name === name);
        return !!p?.isUncapped;
      });
      const currentlyOverseas = myRetentions.filter(name => {
        const p = myTeamRetentionSquad?.find(x => x.name === name);
        return !!p?.isOverseas;
      });

      if (isOverseas) {
        if (currentlyOverseas.length >= 2) {
          setToast({ message: "Maximum 2 overseas players can be retained.", type: "warning" });
          return;
        }
      }

      if (isUncapped) {
        if (currentlyUncapped.length >= rules.maxUncapped) {
          setToast({ message: `Maximum ${rules.maxUncapped} uncapped player can be retained.`, type: "warning" });
          return;
        }
      } else {
        if (currentlyCapped.length >= rules.maxCapped) {
          setToast({ message: `Maximum ${rules.maxCapped} capped players can be retained.`, type: "warning" });
          return;
        }
      }

      if (myRetentions.length >= rules.maxTotal) {
        setToast({ message: `Maximum ${rules.maxTotal} total players can be retained.`, type: "warning" });
        return;
      }

      setMyRetentions(prev => [...prev, playerName]);
    }
  };

  const getPlayerRetentionCost = (playerName, idxInCapped, isUncapped, rules) => {
    if (Object.prototype.hasOwnProperty.call(customPrices, playerName)) {
      return customPrices[playerName];
    }
    if (isUncapped) {
      return rules.uncappedCost;
    }
    return rules.cappedCosts[idxInCapped] || rules.cappedCosts[rules.cappedCosts.length - 1];
  };

  const handlePriceChange = (playerName, valString) => {
    if (valString === '') {
      setCustomPrices(prev => {
        const next = { ...prev };
        delete next[playerName];
        return next;
      });
      return;
    }
    const val = parseFloat(valString);
    if (isNaN(val) || val < 0) return;
    const multiplier = activeLeague === 'wpl' ? 100 : 10;
    const costInUnits = Math.round(val * multiplier);
    setCustomPrices(prev => ({
      ...prev,
      [playerName]: costInUnits
    }));
  };

  const calculateClientRetentionCosts = (selectedList, leagueId) => {
    const rules = RETENTION_RULES[leagueId] || RETENTION_RULES.ipl;
    const cappedSelected = [];
    let uncappedSelected = null;

    selectedList.forEach(name => {
      const playerObj = myTeamRetentionSquad?.find(p => p.name === name);
      if (playerObj?.isUncapped) {
        uncappedSelected = name;
      } else {
        cappedSelected.push(name);
      }
    });

    const breakdown = [];
    cappedSelected.forEach((name, idx) => {
      const cost = getPlayerRetentionCost(name, idx, false, rules);
      breakdown.push({ name, cost, isUncapped: false, slot: idx + 1 });
    });

    if (uncappedSelected) {
      const cost = getPlayerRetentionCost(uncappedSelected, null, true, rules);
      breakdown.push({ name: uncappedSelected, cost, isUncapped: true, slot: null });
    }

    const totalCost = breakdown.reduce((sum, p) => sum + p.cost, 0);
    return { totalCost, breakdown };
  };

  const getTeamRetentionSquad = (teamName) => {
    if (!roomState?.retentionSquads) return null;
    if (roomState.retentionSquads[teamName]) return roomState.retentionSquads[teamName];
    
    // Normalize or match (case insensitive, substring match)
    const normalizedTarget = teamName.toLowerCase().trim();
    for (const key of Object.keys(roomState.retentionSquads)) {
      const normalizedKey = key.toLowerCase().trim();
      if (normalizedKey === normalizedTarget || 
          normalizedTarget.includes(normalizedKey) || 
          normalizedKey.includes(normalizedTarget)) {
        return roomState.retentionSquads[key];
      }
    }
    return null;
  };

  const getRetainedPlayerCost = (teamName, playerName) => {
    // Check if there is a custom price
    if (lobbyCustomPrices?.[teamName]?.[playerName] !== undefined) {
      return lobbyCustomPrices[teamName][playerName];
    }
    if (roomState?.customPricesByTeam?.[teamName]?.[playerName] !== undefined) {
      return roomState.customPricesByTeam[teamName][playerName];
    }
    
    // Fallback: calculate default cost using league rules
    const squad = getTeamRetentionSquad(teamName);
    const player = squad?.find(p => p.name === playerName);
    const isUncapped = !!player?.isUncapped;
    
    const rules = RETENTION_RULES[activeLeague] || RETENTION_RULES.ipl;
    
    // For default slot-based cost, we need to know the index of this player among all capped retentions
    const allRetainedNames = lobbyRetentionStatus[teamName] || [];
    const cappedRetainedNames = allRetainedNames.filter(name => {
      const p = squad?.find(x => x.name === name);
      return !p?.isUncapped;
    });
    
    if (isUncapped) {
      return rules.uncappedCost;
    } else {
      const slotIndex = cappedRetainedNames.indexOf(playerName);
      if (slotIndex !== -1) {
        return rules.cappedCosts[slotIndex] || rules.cappedCosts[rules.cappedCosts.length - 1];
      }
      return rules.cappedCosts[0];
    }
  };

  const handleSubmitRetentions = () => {
    const { breakdown } = calculateClientRetentionCosts(myRetentions, activeLeague);
    const submittedCustomPrices = {};
    breakdown.forEach(item => {
      submittedCustomPrices[item.name] = item.cost;
    });

    socket.emit("submit_retentions", {
      roomCode: roomState?.roomCode,
      retainedPlayers: myRetentions,
      customPrices: submittedCustomPrices
    });
  };

  // ── Derived State ────────────────────────────────────────────────────────
  const myTeam = roomState?.teams?.find((t) =>
    (socket?.id && t.ownerSocketId === socket.id) || (userId && t.ownerUserId === userId)
  );
  const hasClaimedTeam = !!myTeam;
  const isPrimaryHost = (userId && roomState?.hostUserId === userId) || roomState?.host === socket?.id;
  const isCoHost = userId && coHostUserIds.includes(userId);
  const isModerator = isPrimaryHost || isCoHost;

  const currentTeamLimit = roomState?.teamCount || 15;
  const activeLeague = roomState?.league || selectedLeague || 'ipl';
  const theme = LEAGUES[activeLeague] || LEAGUES.ipl;

  const filteredTeams = activeLeague === 'wpl'
    ? WPL_TEAMS.slice(0, currentTeamLimit)
    : activeLeague === 'sa20'
    ? SA20_TEAMS.slice(0, currentTeamLimit)
    : (currentTeamLimit <= 10 ? IPL_TEAMS.slice(0, 10) : IPL_TEAMS.slice(0, currentTeamLimit));
  const displayTeams = availableTeamsForRoom || filteredTeams;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#030712] overflow-x-hidden overflow-y-auto custom-scrollbar">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-10"
          style={{ background: theme.accent }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-[100px] opacity-5"
          style={{ background: theme.accent }} />
      </div>

      <div className="w-full max-w-5xl px-4 sm:px-6 py-6 relative z-10">
        <AnimatePresence mode="wait">
          {!isJoined ? (
            /* ════════════════════════ PRE-JOIN SCREENS ════════════════════════ */
            <AnimatePresence mode="wait">

              {/* ── Step 1: Choose League ── */}
              {lobbyStep === "league" && (
                <motion.div
                  key="league-select"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <div className="text-center mb-10 pt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                      <Trophy className="w-3 h-3" /> Choose Your Tournament
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      Pick a <span className="text-gold-gradient">League</span>
                    </h1>
                    <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto">
                      Select the cricket league you want to run an auction for
                    </p>
                  </div>

                  {/* League Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {Object.values(LEAGUES).map((lg) => (
                      <motion.button
                        key={lg.id}
                        whileHover={{ y: -6, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setSelectedLeague(lg.id);
                          if (lg.id === 'ipl') {
                            setLobbyStep("setup");
                            setSelectedYear(null);
                          } else {
                            setLobbyStep("year");
                            setSelectedYear(null);
                          }
                          setLocalLobbySettings(prev => ({
                            ...prev,
                            teamCount: lg.id === 'sa20' ? 6 : (lg.id === 'wpl' ? 5 : 15)
                          }));
                        }}
                        className="relative flex flex-col items-center text-center p-8 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group overflow-hidden"
                      >
                        {/* Hover glow */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                          style={{ background: `radial-gradient(circle at 50% 0%, ${lg.accentDim}, transparent 70%)` }} />

                        {/* Logo */}
                        <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl"
                            style={{ background: lg.accentDim }} />
                          <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center relative z-10">
                            <img src={lg.logoUrl} alt={lg.label} className="w-10 h-10 object-contain" />
                          </div>
                        </div>

                        {/* Title */}
                        <div className="text-xl font-black text-white uppercase tracking-wide mb-1">{lg.label}</div>
                        <div className="text-[11px] font-bold uppercase tracking-widest mb-3"
                          style={{ color: lg.accent }}>{lg.subtitle}</div>

                        {/* Description */}
                        <p className="text-slate-500 text-xs leading-relaxed mb-6">{lg.description}</p>

                        {/* CTA */}
                        <div className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all"
                          style={{
                            borderColor: `${lg.accent}40`,
                            color: lg.accent,
                            background: `${lg.accent}10`
                          }}>
                          Play This League →
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Step 1.5: Choose Year ── */}
              {lobbyStep === "year" && (
                <motion.div
                  key="year-select"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Back button */}
                  <div className="flex items-center gap-4 mb-8">
                    <button
                      onClick={() => setLobbyStep("league")}
                      className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to Leagues
                    </button>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                        <img src={league.logoUrl} alt={league.label} className="w-5 h-5 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selected League</div>
                        <div className="text-sm font-black text-white truncate">{league.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  {/* Header */}
                  <div className="text-center mb-10 pt-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                      <Hash className="w-3 h-3" /> Select Auction Season / Year
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      Choose the <span className="text-gold-gradient">Year</span>
                    </h1>
                    <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto">
                      Choose the season to auction. First seasons have no player retention option.
                    </p>
                  </div>

                  {/* Year Selection Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto font-sans">
                    {(LEAGUE_YEARS[selectedLeague] || []).map((yr) => {
                      const isFirstYear = LEAGUE_FIRST_YEAR[selectedLeague] === yr;
                      return (
                        <motion.button
                          key={yr}
                          whileHover={{ y: -4, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedYear(yr);
                            setLobbyStep("setup");
                          }}
                          className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group overflow-hidden"
                        >
                          {/* Hover glow */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                            style={{ background: `radial-gradient(circle at 50% 0%, ${league.accentDim}, transparent 70%)` }} />

                          {/* Year label */}
                          <div className="text-2xl font-black text-white tracking-wide mb-1 group-hover:scale-105 transition-transform">{yr}</div>
                          <div className="text-[9px] font-bold uppercase tracking-widest mt-2"
                            style={{ color: isFirstYear ? '#ef4444' : league.accent }}>
                            {isFirstYear ? 'No Retentions' : 'Retentions Enabled'}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">
                            {isFirstYear ? 'Inaugural season' : 'Previous year rosters loaded'}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Create / Join Room ── */}
              {lobbyStep === "setup" && (
                <motion.div
                  key="room-setup"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="pt-6"
                >
                  {/* Back + League Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      {!isDirectJoining && (
                        <button
                          onClick={() => setLobbyStep(selectedLeague === 'ipl' ? "league" : "year")}
                          className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors shrink-0"
                        >
                          <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                          <img src={league.logoUrl} alt={league.label} className="w-5 h-5 object-contain" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selected League</div>
                          <div className="text-sm font-black text-white truncate">{league.subtitle} {selectedYear ? `(${selectedYear})` : ''}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowRulesDrawer(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 active:scale-98"
                    >
                      <Info className="w-4 h-4" style={{ color: league.accent }} /> View Rules & Features
                    </button>
                  </div>

                  {/* ── League News Marquee Ticker ── */}
                  <div className="mb-6">
                    <LeagueNewsMarquee league={selectedLeague} />
                  </div>

                  <div className="max-w-md mx-auto w-full">
                    {/* Right: Actions */}
                    <div className="space-y-5">
                      {/* Name Input */}
                      <div className="space-y-2">
                        <label className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Name</span>
                          {playerName && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">Saved</span>
                              <button
                                onClick={() => { sessionStorage.removeItem('ipl_session_token'); window.location.reload(); }}
                                className="text-[9px] font-bold text-slate-600 hover:text-white transition-colors"
                              >Sign out</button>
                            </div>
                          )}
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your name…"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold text-sm placeholder:text-slate-600 focus:outline-none focus:border-white/30 transition-all"
                          style={{ '--tw-ring-color': league.accent }}
                          value={localNameInput}
                          onChange={(e) => setLocalNameInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !isDirectJoining && handleCreate()}
                        />
                      </div>

                      {/* Room Type Tabs */}
                      {!isDirectJoining ? (
                        <>
                          <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Room Type</label>
                            <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                              {[
                                { id: 'private', label: 'Private', icon: <Lock className="w-3 h-3" />, desc: 'Invite only' },
                                { id: 'public',  label: 'Public',  icon: <Globe className="w-3 h-3" />, desc: 'Anyone can join' },
                                { id: 'ai',      label: 'vs AI',   icon: <Cpu className="w-3 h-3" />,  desc: 'Play solo' },
                              ].map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => setCreatingRoomType(t.id)}
                                  className={`relative py-2.5 px-2 rounded-lg text-center transition-all ${
                                    creatingRoomType === t.id ? '' : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  {creatingRoomType === t.id && (
                                    <motion.div
                                      layoutId="roomTypeActive"
                                      className="absolute inset-0 rounded-lg"
                                      style={{ background: league.accent }}
                                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                  )}
                                  <div className={`relative z-10 flex flex-col items-center gap-1 ${
                                    creatingRoomType === t.id
                                      ? (league.id === 'ipl' ? 'text-[#1a1205]' : 'text-white')
                                      : ''
                                  }`}>
                                    {t.icon}
                                    <span className="text-[10px] font-black uppercase tracking-wider">{t.label}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Currency Selection */}
                          <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                              <span>Auction Currency</span>
                              <span className="text-[10px] font-bold text-amber-400/80">Shows USD with exact INR equivalent</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-xl border border-white/5">
                              {[
                                { 
                                  id: selectedLeague === 'sa20' ? 'zar' : 'inr', 
                                  label: selectedLeague === 'sa20' ? 'Rand (ZAR)' : 'Rupees (INR)', 
                                  symbol: selectedLeague === 'sa20' ? 'R' : '₹', 
                                  badge: 'Primary' 
                                },
                                { 
                                  id: 'usd', 
                                  label: 'US Dollar (USD)', 
                                  symbol: '$', 
                                  badge: 'Alternative' 
                                }
                              ].map((c) => {
                                const defaultCurrency = selectedLeague === 'sa20' ? 'zar' : 'inr';
                                const activeCurrency = selectedCurrency || defaultCurrency;
                                const isActive = activeCurrency === c.id;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedCurrency(c.id)}
                                    className={`relative py-3.5 px-3 rounded-lg text-center transition-all overflow-hidden ${
                                      isActive ? '' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                  >
                                    {isActive && (
                                      <motion.div
                                        layoutId="activeCurrencyBg"
                                        className="absolute inset-0 rounded-lg bg-gradient-to-r"
                                        style={{ 
                                          background: `linear-gradient(135deg, ${league.accent}, ${league.accentLight})`
                                        }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                      />
                                    )}
                                    <div className={`relative z-10 flex items-center justify-center gap-2 ${
                                      isActive 
                                        ? (league.id === 'ipl' ? 'text-[#1a1205]' : 'text-white') 
                                        : ''
                                    }`}>
                                      <span className="text-sm font-black font-mono">{c.symbol}</span>
                                      <div className="flex flex-col items-start leading-none text-left">
                                        <span className="text-[11px] font-black uppercase tracking-wider">{c.label}</span>
                                        <span className={`text-[8px] font-bold ${isActive ? 'opacity-80' : 'text-slate-600'} mt-0.5`}>{c.badge}</span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="space-y-3">
                            <button
                              onClick={handleCreate}
                              disabled={isAutoJoining}
                              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:-translate-y-0.5 active:scale-98 disabled:opacity-50"
                              style={{ background: `linear-gradient(135deg, ${league.accent}, ${league.accentLight})`, color: league.id === 'ipl' ? '#1a1205' : 'white' }}
                            >
                              {isAutoJoining ? (
                                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                              {isAutoJoining ? 'Creating…' : 'Create Room'}
                            </button>

                            {/* Join with code */}
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                  type="text"
                                  placeholder="Enter room code"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white font-bold text-sm placeholder:text-slate-600 focus:outline-none focus:border-white/25 transition-all uppercase tracking-widest text-center"
                                  value={roomCodeInput}
                                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                  onKeyDown={(e) => e.key === 'Enter' && roomCodeInput.length >= 6 && handleJoin(roomCodeInput)}
                                />
                              </div>
                              <button
                                onClick={() => handleJoin(roomCodeInput)}
                                disabled={roomCodeInput.length < 6 || isAutoJoining}
                                className="px-4 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5"
                                style={{ background: `${league.accent}20`, color: league.accent, border: `1px solid ${league.accent}40` }}
                              >
                                Join
                              </button>
                            </div>

                            {/* Secondary actions */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => navigate("/public-rooms", { state: { selectedLeague } })}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/10"
                              >
                                <Globe className="w-3.5 h-3.5" /> Browse Rooms
                              </button>
                              <button
                                onClick={() => handleSpectate(roomCodeInput)}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/10"
                              >
                                <Eye className="w-3.5 h-3.5" /> Watch Only
                              </button>
                            </div>
                          </div>

                        </>
                      ) : (
                        /* Direct Join (from invite link) */
                        <div className="space-y-4">
                          <div className="p-6 rounded-2xl border text-center"
                            style={{ background: `${league.accentDim}`, borderColor: `${league.accent}30` }}>
                            <div className="text-xs font-bold uppercase tracking-widest mb-2"
                              style={{ color: league.accent }}>You've been invited</div>
                            <div className="text-4xl font-black text-white tracking-widest mb-1">{roomCodeInput}</div>
                            <div className="text-xs text-slate-500">Room Code</div>
                          </div>
                          <button
                            onClick={() => handleJoin(roomCodeInput)}
                            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:-translate-y-0.5"
                            style={{ background: `linear-gradient(135deg, ${league.accent}, ${league.accentLight})`, color: league.id === 'ipl' ? '#1a1205' : 'white' }}
                          >
                            Join This Room
                          </button>
                          <button
                            onClick={() => handleSpectate(roomCodeInput)}
                            className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-all"
                          >
                            <Eye className="w-4 h-4 inline mr-2" />Watch Only
                          </button>
                          <button
                            onClick={() => { setIsDirectJoining(false); navigate("/", { replace: true }); }}
                            className="w-full text-center text-xs font-bold text-slate-600 hover:text-slate-400 transition-colors py-1"
                          >
                            ← Go back to home
                          </button>
                        </div>
                      )}

                      {/* Error */}
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3"
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                              <p className="text-xs text-red-400 font-bold">
                                {error === 'SPECTATOR_APPROVAL_REQUIRED'
                                  ? "This room needs host approval to watch"
                                  : error === 'PLAYER_JOIN_DISABLED'
                                  ? "Auction has already started. You can't join as a player."
                                  : error}
                              </p>
                            </div>
                            {error === 'SPECTATOR_APPROVAL_REQUIRED' && !isPendingApproval && (
                              <button
                                onClick={handleRequestAccess}
                                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all"
                              >
                                Send Join Request
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Pending approval */}
                      {isPendingApproval && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-xl border flex items-center gap-3"
                          style={{ background: `${league.accentDim}`, borderColor: `${league.accent}30` }}
                        >
                          <div className="w-6 h-6 border-2 rounded-full animate-spin shrink-0"
                            style={{ borderColor: `${league.accent}30`, borderTopColor: league.accent }} />
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest" style={{ color: league.accent }}>
                              Waiting for host approval
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Your request to watch has been sent…</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          ) : (
            /* ════════════════════════ IN-ROOM SCREENS ════════════════════════ */
            <motion.div
              key="in-room"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-4"
            >
              {/* ── Room Header Bar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* League badge */}
                  <div className="flex items-center gap-2">
                    <img src={theme.logoUrl} alt={theme.label} className="w-7 h-7 object-contain" />
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: theme.accent }}>{theme.subtitle}</span>
                  </div>
                  <div className="h-4 w-px bg-white/10 hidden sm:block" />
                  {/* Room Code */}
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Room Code</div>
                      <div className="text-xl font-black text-white tracking-[0.2em]">{roomState?.roomCode}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={handleCopyLink} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-all" title="Copy invite link">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={handleShareWhatsapp} className="p-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-lg text-emerald-400 transition-all" title="Share on WhatsApp">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Voice + Leave */}
                <div className="flex items-center gap-2">
                  <VoiceControls roomCode={roomState?.roomCode} />
                  <button onClick={handleLeaveRoom}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500 hover:text-white transition-all">
                    <LogOut className="w-3.5 h-3.5" /> Leave
                  </button>
                </div>
              </div>

              {/* ── League News Marquee Ticker (In-Room Lobby) ── */}
              <div className="mb-6">
                <LeagueNewsMarquee league={activeLeague} />
              </div>

              {/* ── Lobby Waiting Area / Dashboard ── */}
              {!hasClaimedTeam && !isSpectatorMode ? (
                /* ── Team Picker ── */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">Pick Your Team</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Choose the franchise you want to manage in this auction</p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Step 2 of 3</span>
                  </div>

                  <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {displayTeams.map((team) => {
                      const teamKey = team.id || team.shortName;
                      const isClaimed = roomState?.teams?.some((t) => t.teamName === team.name);
                      const isSelected = selectedTeamId === teamKey;
                      return (
                        <motion.button
                          key={teamKey}
                          whileHover={!isClaimed ? { scale: 1.08, y: -4 } : {}}
                          whileTap={!isClaimed ? { scale: 0.95 } : {}}
                          onClick={() => !isClaimed && setSelectedTeamId(teamKey)}
                          title={team.name}
                          className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center p-3 transition-all overflow-hidden ${
                            isClaimed
                              ? 'opacity-30 grayscale cursor-not-allowed bg-white/5 border-white/5'
                              : isSelected
                              ? 'bg-white/10 cursor-pointer'
                              : 'bg-white/[0.03] border-white/10 hover:border-white/20 cursor-pointer'
                          }`}
                          style={isSelected ? { borderColor: theme.accent, boxShadow: `0 0 20px ${theme.accentDim}` } : {}}
                        >
                          {isSelected && (
                            <motion.div layoutId="team-glow"
                              className="absolute inset-0 opacity-20"
                              style={{ background: `radial-gradient(circle, ${theme.accent}, transparent)` }} />
                          )}
                          <img src={team.logoUrl} alt={teamKey} className="w-full h-full object-contain relative z-10" />
                          {isClaimed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 rounded-xl">
                              <span className="text-[8px] font-black text-white uppercase tracking-wider">Taken</span>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {selectedTeamId && (() => {
                    const t = displayTeams.find(t => (t.id || t.shortName) === selectedTeamId);
                    const pData = presignedByTeam[selectedTeamId];
                    const isLeagueSA20 = (roomState?.league || activeLeague) === 'sa20';
                    const currency = roomState?.currency || 'inr';
                    const sourceCurrency = LEAGUE_DEFAULTS[roomState?.league || activeLeague] || 'inr';

                    return t ? (
                      <div className="space-y-3">
                        {/* Presigned preview panel for SA20 */}
                        {isLeagueSA20 && pData && pData.players.length > 0 && (
                          <div
                            className="rounded-2xl border overflow-hidden"
                            style={{ background: 'rgba(0,0,0,0.45)', borderColor: `${theme.accent}35` }}
                          >
                            {/* Header */}
                            <div
                              className="flex items-center justify-between px-4 py-3"
                              style={{ background: `linear-gradient(135deg, ${theme.accentDim}, transparent)`, borderBottom: `1px solid ${theme.accent}25` }}
                            >
                              <div className="flex items-center gap-2">
                                <img src={t.logoUrl} alt={t.name} className="w-7 h-7 object-contain" />
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.accent }}>Pre-Signed Squad</div>
                                  <div className="text-xs font-black text-white">{t.name}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Remaining Budget</div>
                                <div className="text-lg font-black" style={{ color: theme.accent }}>
                                  {fmtCr(pData.remainingPurse, currency, sourceCurrency)}
                                </div>
                                <div className="text-[9px] text-slate-600">
                                  of {fmtCr(pData.startingPurse, currency, sourceCurrency)} · {fmtCr(pData.totalCost, currency, sourceCurrency)} committed
                                </div>
                              </div>
                            </div>

                            {/* Purse Bar */}
                            <div className="px-4 pt-2 pb-1">
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, ((pData.remainingPurse || 0) / (pData.startingPurse || (isLeagueSA20 ? 410 : 2400))) * 100))}%`,
                                    background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentLight})`
                                  }}
                                />
                              </div>
                            </div>

                            {/* Player List */}
                            <div className="px-3 pb-3 space-y-1.5">
                              {pData.players.map((p, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className="w-1.5 h-5 rounded-full shrink-0"
                                      style={{
                                        background: p.isOverseas
                                          ? 'linear-gradient(180deg,#f59e0b,#d97706)'
                                          : 'linear-gradient(180deg,#6ee7b7,#34d399)'
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-white truncate">{p.name}</div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{p.role}</span>
                                        {p.isOverseas && (
                                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">OVERSEAS</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Disclaimer */}
                            <div className="px-4 pb-3">
                              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${theme.accent}20` }}>
                                <p className="text-[9px] font-bold leading-relaxed" style={{ color: theme.accent }}>
                                  ⚡ These players are pre-signed — they'll be on your squad from day one and their costs are already deducted from your budget.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Confirm bar */}
                        <div
                          className="flex items-center justify-between p-4 rounded-xl border"
                          style={{ background: theme.accentDim, borderColor: `${theme.accent}30` }}
                        >
                          <div className="flex items-center gap-3">
                            <img src={t.logoUrl} alt={t.name} className="w-10 h-10 object-contain" />
                            <div>
                              <div className="text-xs font-bold text-slate-500 uppercase">Selected</div>
                              <div className="text-sm font-black text-white">{t.name}</div>
                            </div>
                          </div>
                          <button
                            onClick={handleClaimTeam}
                            className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:-translate-y-0.5"
                            style={{
                              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight})`,
                              color: theme.id === 'ipl' ? '#1a1205' : 'white'
                            }}
                          >
                            Confirm Team →
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

              ) : (
                /* ── Room Dashboard (has team) ── */
                <div>
                  {myTeamRetentionSquad && retentionConfirmed && (
                    <div className="p-4 mb-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 font-sans text-left">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                          🔒 Retentions Submitted
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          Purse deduction will apply when the auction starts.
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {myRetentions.length === 0 ? (
                          <span className="text-xs font-bold text-slate-400 italic">No players retained (starting with full purse)</span>
                        ) : (
                          myRetentions.map(name => {
                            const breakdown = calculateClientRetentionCosts(myRetentions, activeLeague).breakdown;
                            const cost = breakdown.find(b => b.name === name)?.cost || 0;
                            return (
                              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white">
                                {name}
                                <span className="text-[10px]" style={{ color: theme.accent }}>
                                  ({fmtCr(cost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')})
                                </span>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {myTeamRetentionSquad && !retentionConfirmed && !isSpectatorMode ? (
                    /* ── Retention Panel UI ── */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6 font-sans mb-6 text-left"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
                        <div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5" style={{ color: theme.accent }} />
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">
                              Player Retention Setup
                            </h2>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Retain your favorite players from your previous season's squad. Slot-based costs apply.
                          </p>
                        </div>
                        
                        {/* Rules Summary Card */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-right flex flex-col items-end shrink-0">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Max Limits ({activeLeague.toUpperCase()})
                          </div>
                          <div className="text-xs font-black text-white mt-0.5">
                            {(() => {
                              const r = RETENTION_RULES[activeLeague] || RETENTION_RULES.ipl;
                              return `Max Capped: ${r.maxCapped} · Max Uncapped: ${r.maxUncapped}`;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Main Layout Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Previous Squad Grid (2 columns span) */}
                        <div className="lg:col-span-2 space-y-4">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Previous Season Squad ({myTeam?.teamName})
                          </h3>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {myTeamRetentionSquad.map((player) => {
                              const isSelected = myRetentions.includes(player.name);
                              const playerRules = RETENTION_RULES[activeLeague] || RETENTION_RULES.ipl;
                              
                              // Calculate hypothetical cost if we retain this single player
                              let estCost = 0;
                              if (player.isUncapped) {
                                estCost = playerRules.uncappedCost;
                              } else {
                                const cappedCount = myRetentions.filter(n => {
                                  const p = myTeamRetentionSquad.find(x => x.name === n);
                                  return !p?.isUncapped && n !== player.name;
                                }).length;
                                estCost = playerRules.cappedCosts[isSelected ? cappedCount : cappedCount] || playerRules.cappedCosts[playerRules.cappedCosts.length - 1];
                              }

                              return (
                                <button
                                  key={player.name}
                                  onClick={() => toggleRetainedPlayer(player.name)}
                                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                                    isSelected
                                      ? 'bg-white/5'
                                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                                  }`}
                                  style={isSelected ? { borderColor: theme.accent, boxShadow: `0 0 12px ${theme.accentDim}` } : {}}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-1.5 h-6 rounded-full shrink-0 ${
                                        player.isUncapped ? 'bg-emerald-400' : 'bg-amber-400'
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-white truncate">{player.name}</div>
                                      <span className="inline-flex mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-500 font-sans">
                                        {player.isUncapped ? 'UNCAPPED' : 'CAPPED'}
                                      </span>
                                      {player.isOverseas && (
                                        <span className="inline-flex mt-0.5 ml-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-sans">
                                          OVERSEAS
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right shrink-0">
                                    <div className="text-xs font-black text-white">
                                      {fmtCr(estCost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                                    </div>
                                    <div className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">
                                      {isSelected ? 'Selected' : 'Est Cost'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Right: Summary & Action */}
                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between h-fit space-y-6">
                          <div className="space-y-4">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">
                              Retention Summary
                            </h3>

                            {/* Selected list */}
                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                              {myRetentions.length === 0 ? (
                                <p className="text-[10px] text-slate-600 font-bold italic py-2">
                                  No players selected. Starting purse will remain fully intact.
                                </p>
                              ) : (
                                (() => {
                                  const { breakdown } = calculateClientRetentionCosts(myRetentions, activeLeague);
                                  return breakdown.map((item) => (
                                    <div
                                      key={item.name}
                                      className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs font-bold"
                                    >
                                      <div className="flex flex-col min-w-0 mr-2 text-left">
                                        <span className="text-white truncate max-w-[120px]">{item.name}</span>
                                        <span className="text-slate-500 font-mono text-[9px] mt-0.5">
                                          {item.isUncapped ? 'Uncapped' : `Slot ${item.slot}`}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {retentionConfirmed ? (
                                          <span className="text-white font-mono">
                                            {fmtCr(item.cost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                                          </span>
                                        ) : (
                                          <React.Fragment>
                                            <input
                                              type="number"
                                              step={activeLeague === 'wpl' ? 0.05 : 0.1}
                                              min={0}
                                              value={customPrices[item.name] !== undefined 
                                                ? (customPrices[item.name] / (activeLeague === 'wpl' ? 100 : 10)) 
                                                : (item.cost / (activeLeague === 'wpl' ? 100 : 10))
                                              }
                                              onChange={(e) => handlePriceChange(item.name, e.target.value)}
                                              className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-xs text-white focus:outline-none focus:border-pink-500/50"
                                            />
                                            <span className="text-[9px] text-slate-500 font-sans uppercase">
                                              {activeLeague === 'wpl' ? 'Cr' : 'M'}
                                            </span>
                                          </React.Fragment>
                                        )}
                                      </div>
                                    </div>
                                  ));
                                })()
                              )}
                            </div>

                            {/* Cost Breakdown */}
                            <div className="pt-4 border-t border-white/10 space-y-2 font-mono">
                              {(() => {
                                const { totalCost } = calculateClientRetentionCosts(myRetentions, activeLeague);
                                const totalPurse = myTeam?.startingPurse || (activeLeague === 'sa20' ? 410 : (activeLeague === 'wpl' ? 1500 : 12000));
                                const remaining = Math.max(0, totalPurse - totalCost);
                                return (
                                  <>
                                    <div className="flex justify-between text-xs text-slate-500">
                                      <span>Total Purse:</span>
                                      <span>{fmtCr(totalPurse, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                      <span>Retention Cost:</span>
                                      <span>{fmtCr(totalCost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-dashed border-white/10">
                                      <span>Remaining:</span>
                                      <span style={{ color: theme.accent }}>
                                        {fmtCr(remaining, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Submit Action Buttons */}
                          <div className="space-y-2 pt-2">
                            {(() => {
                              const { totalCost } = calculateClientRetentionCosts(myRetentions, activeLeague);
                              const totalPurse = myTeam?.startingPurse || (activeLeague === 'sa20' ? 410 : (activeLeague === 'wpl' ? 1500 : 12000));
                              const maxCapped = activeLeague === 'wpl' ? 3 : 4;
                              const maxUncapped = 1;
                              const maxTotal = maxCapped + maxUncapped;

                              let hasValidationError = false;
                              let validationErrorMessage = "";

                              if (myRetentions.length === maxTotal) {
                                const requiredTotal = activeLeague === 'wpl' ? 900 : 250;
                                if (totalCost !== requiredTotal) {
                                  hasValidationError = true;
                                  const label = activeLeague === 'wpl' ? '₹9.00 Cr' : 'R 25.0M';
                                  validationErrorMessage = `When retaining the maximum ${maxTotal} players, total cost must equal exactly ${label}. Current total: ${fmtCr(totalCost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}`;
                                }
                              }

                              if (totalCost > totalPurse) {
                                hasValidationError = true;
                                validationErrorMessage = `Total cost exceeds team purse limit.`;
                              }

                              return (
                                <>
                                  {validationErrorMessage && (
                                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 text-center leading-normal mb-2">
                                      {validationErrorMessage}
                                    </div>
                                  )}
                                  <button
                                    onClick={handleSubmitRetentions}
                                    disabled={hasValidationError}
                                    className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-center transition-all ${
                                      hasValidationError 
                                        ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500' 
                                        : 'hover:-translate-y-0.5'
                                    }`}
                                    style={hasValidationError ? {} : {
                                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight || theme.accent})`,
                                      color: theme.id === 'ipl' ? '#1a1205' : 'white',
                                      boxShadow: `0 4px 14px ${theme.accentDim}`
                                    }}
                                  >
                                    Submit Retentions
                                  </button>
                                </>
                              );
                            })()}
                            
                            <button
                              onClick={() => {
                                setMyRetentions([]);
                                setCustomPrices({});
                                socket.emit("submit_retentions", {
                                  roomCode: roomState?.roomCode,
                                  retainedPlayers: [],
                                  customPrices: {}
                                });
                              }}
                              className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-400 text-center transition-all"
                            >
                              Skip — Retain None
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Rules + Host Controls */}
                  <div className="space-y-4">
                    {isSpectatorMode && (
                      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4" style={{ borderColor: `${theme.accent}30` }}>
                        {/* Header */}
                        <div className="flex items-center gap-3.5 pb-3 border-b border-white/5">
                          <div className="p-2.5 rounded-xl border flex items-center justify-center shrink-0" style={{ background: theme.accentDim, borderColor: `${theme.accent}40`, color: theme.accent }}>
                            <Eye className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.accent }}>Watching Mode</div>
                            <h3 className="text-sm font-black text-white mt-0.5">Lobby Spectator</h3>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed font-sans">
                          You are currently watching the lobby. When the host starts the auction, you will transition to the live podium as a spectator.
                        </p>

                        {/* Vacant Teams */}
                        <div className="space-y-3 pt-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-sans">
                            Vacant Teams in Room
                          </span>

                          {(() => {
                            const vacant = displayTeams.filter(team => !roomState?.teams?.some((t) => t.teamName === team.name));
                            if (vacant.length === 0) {
                              return (
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 text-center font-sans">
                                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-1">Lobby is Full</span>
                                  <p className="text-[10px] text-slate-500 leading-normal">
                                    No vacant teams are available to claim.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-2 gap-2.5 font-sans">
                                {vacant.map((team) => {
                                  const teamKey = team.id || team.shortName;
                                  return (
                                    <button
                                      key={teamKey}
                                      onClick={() => {
                                        socket.emit("claim_team", { roomCode: roomState?.roomCode, teamId: teamKey });
                                      }}
                                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all group active:scale-95 text-center relative overflow-hidden"
                                      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                                    >
                                      <div className="w-10 h-10 mb-2 relative z-10 flex items-center justify-center">
                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
                                      </div>
                                      <span className="text-[10px] font-black text-white truncate w-full relative z-10">{team.name}</span>
                                      <span className="text-[8px] font-black uppercase tracking-wider mt-1 transition-colors relative z-10" style={{ color: theme.accent }}>
                                        Claim Team →
                                      </span>
                                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(to top, ${theme.accentDim}, transparent)` }} />
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Auction Rules */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="text-xs font-black text-white uppercase tracking-widest">Auction Rules</span>
                      </div>
                      <div className="space-y-2.5">
                        {Object.entries(theme.rules).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {key === 'squad' ? 'Squad Size' : key === 'overseas' ? 'Overseas Players' : key === 'bowling' ? 'Min Pure Bowlers' : key === 'keeping' ? 'Min Wicketkeepers' : key === 'uncapped' ? 'Uncapped Players' : key === 'domestic' ? 'South African Players' : 'U-23 Players'}
                            </span>
                            <span className="text-xs font-black text-white">{val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                        <p className="text-[9px] text-red-400 font-bold leading-relaxed">
                          Breaking these rules will disqualify your team at the end of the auction.
                        </p>
                      </div>
                    </div>

                    {/* Host Controls */}
                    {isModerator && (
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Host Controls</span>
                          <button
                            onClick={() => {
                              setLocalLobbySettings({
                                allowSpectators: roomState?.allowSpectators !== false,
                                maxSpectators: roomState?.maxSpectators || 10,
                                teamCount: roomState?.teamCount || (activeLeague === 'sa20' ? 6 : (activeLeague === 'wpl' ? 5 : 15))
                              });
                              setShowSettings(true);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-600 hover:text-white"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={handleStart}
                          className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:-translate-y-0.5 hover:shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight})`,
                            color: theme.id === 'ipl' ? '#1a1205' : 'white',
                            boxShadow: `0 4px 20px ${theme.accentDim}`
                          }}
                        >
                          🚀 Start Auction
                        </button>
                        <p className="text-[9px] text-slate-600 text-center">At least 3 players must pick a team before you start</p>
                      </div>
                    )}
                  </div>

                  {/* Right Columns: Players + Watchers */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Players in Room */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Players in Room</h3>
                        <span className="text-xs font-bold text-slate-500">{roomState?.teams?.length || 0} joined</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-72">
                        {roomState?.teams?.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                            {/* Team Logo */}
                            <div className="w-8 h-8 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center p-1 shrink-0">
                              {t.teamLogo
                                ? <img src={t.teamLogo} alt="" className="w-full h-full object-contain" />
                                : <span className="text-xs font-black text-slate-500">{(t.teamName || '?')[0]}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-black text-white truncate">{t.teamName}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${onlineMap[t.ownerUserId] === false ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                {isEditingName && t.ownerUserId === userId ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={tempName}
                                      onChange={(e) => setTempName(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleChangeName()}
                                      className="bg-white/10 border-b border-white/30 text-[10px] font-bold text-white focus:outline-none w-20"
                                    />
                                    <button onClick={handleChangeName} className="text-emerald-400"><Check className="w-3 h-3" /></button>
                                    <button onClick={() => setIsEditingName(false)} className="text-red-400"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500 truncate">{t.ownerName}</span>
                                )}
                                {t.isBot && <Bot className="w-3 h-3 text-sky-400" />}
                                {t.ownerSocketId && voiceParticipants?.has(t.ownerSocketId) && (
                                  <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
                                )}
                              </div>
                            </div>
                            {roomState?.retentionSquads && (() => {
                              const isSubmitted = lobbyRetentionStatus[t.teamName] !== undefined && lobbyRetentionStatus[t.teamName] !== null;
                              let rtmLabel = '';
                              if (isSubmitted && (roomState.league === 'wpl' || roomState.league === 'sa20')) {
                                const retainedCount = (lobbyRetentionStatus[t.teamName] || []).length;
                                const maxPossible = roomState.league === 'wpl' ? 4 : 5;
                                const rtmCards = maxPossible - retainedCount + 1;
                                rtmLabel = ` (${rtmCards} RTM)`;
                              }
                              return (
                                <button
                                  onClick={() => isSubmitted && setRetentionsModalTeam(t)}
                                  disabled={!isSubmitted}
                                  className={`text-[9px] font-black px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 transition-all ${
                                    isSubmitted 
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-400/20 cursor-pointer hover:scale-105 active:scale-95' 
                                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse cursor-not-allowed'
                                  }`}
                                >
                                  {isSubmitted && <Eye className="w-3 h-3 text-emerald-400/70" />}
                                  <span>{isSubmitted ? `READY${rtmLabel}` : 'RETAINING'}</span>
                                </button>
                              );
                            })()}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isPrimaryHost && t.ownerUserId !== userId && (
                                <button
                                  onClick={() => handleToggleCoHost(t.ownerUserId)}
                                  className={`p-1.5 rounded-lg transition-all ${coHostUserIds.includes(t.ownerUserId) ? 'text-amber-400 bg-amber-400/10' : 'text-slate-600 hover:text-white'}`}
                                  title="Make co-host"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isModerator && t.ownerUserId !== userId && (
                                <button
                                  onClick={() => setKickTarget({ socketId: t.ownerSocketId, name: t.ownerName })}
                                  className="p-1.5 text-slate-600 hover:text-red-400 transition-all"
                                  title="Remove player"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {t.ownerUserId === userId && (
                                <button
                                  onClick={() => { setTempName(t.ownerName); setIsEditingName(true); }}
                                  className="p-1.5 text-slate-600 hover:text-white transition-all"
                                  title="Edit name"
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right side: Join requests + Watchers */}
                    <div className="space-y-4 flex flex-col">
                      {/* Join Requests */}
                      {isPrimaryHost && joinRequests.length > 0 && (
                        <div className="p-4 rounded-2xl border"
                          style={{ background: `${theme.accentDim}`, borderColor: `${theme.accent}30` }}>
                          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-3 animate-pulse"
                            style={{ color: theme.accent }}>
                            <AlertTriangle className="w-3 h-3" /> Join Requests ({joinRequests.length})
                          </h3>
                          <div className="space-y-2">
                            {joinRequests.map((req) => (
                              <div key={req.socketId} className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/10">
                                <span className="text-xs font-bold text-white truncate">{req.name}</span>
                                <div className="flex gap-1.5 ml-2">
                                  <button
                                    onClick={() => socket.emit("approve_participation", { roomCode: roomState.roomCode, targetSocketId: req.socketId })}
                                    className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                    title="Approve"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => socket.emit("reject_participation", { roomCode: roomState.roomCode, targetSocketId: req.socketId })}
                                    className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                    title="Decline"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Watchers */}
                      <div className="flex-1 p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col min-h-[180px]">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                          Watchers ({spectators.length})
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5">
                          {spectators.length === 0 ? (
                            <p className="text-[10px] text-slate-700 font-bold text-center py-4">No one is watching yet</p>
                          ) : spectators.map((s) => (
                            <div key={s.socketId} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-black text-slate-500">
                                {s.name?.charAt(0)}
                              </div>
                              <span className="text-[11px] font-bold text-slate-400">{s.name}</span>
                              {s.socketId === socket.id && (
                                <span className="ml-auto text-[8px] font-black text-white px-2 py-0.5 rounded-full"
                                  style={{ background: theme.accent }}>You</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ════════════ MODALS ════════════ */}
      <AnimatePresence>
        {/* Retained Players View Modal */}
        {retentionsModalTeam && (() => {
          const teamName = retentionsModalTeam.teamName;
          const logo = retentionsModalTeam.teamLogo;
          const owner = retentionsModalTeam.ownerName;
          
          const retainedList = lobbyRetentionStatus[teamName] || [];
          const squad = getTeamRetentionSquad(teamName) || [];
          
          // Calculate costs
          let totalCost = 0;
          const breakdown = retainedList.map((name) => {
            const cost = getRetainedPlayerCost(teamName, name);
            const playerObj = squad.find(p => p.name === name);
            totalCost += cost;
            return {
              name,
              cost,
              isUncapped: !!playerObj?.isUncapped,
              isOverseas: !!playerObj?.isOverseas,
              role: playerObj?.role || 'Player'
            };
          });
          
          const totalPurse = retentionsModalTeam.startingPurse || (activeLeague === 'sa20' ? 410 : (activeLeague === 'wpl' ? 1500 : 12000));
          const remaining = Math.max(0, totalPurse - totalCost);
          
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => setRetentionsModalTeam(null)}
            >
              <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative"
              >
                {/* Header with team theme coloring */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: retentionsModalTeam.teamThemeColor || theme.accent }}
                />
                
                <div className="p-6 space-y-6">
                  {/* Title & Close */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {logo ? (
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                          <img src={logo} alt="" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-black text-sm shrink-0">
                          {teamName[0]}
                        </div>
                      )}
                      <div className="text-left">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Retained Squad</h3>
                        <h4 className="text-lg font-black text-white leading-none">{teamName}</h4>
                        <span className="text-[10px] text-slate-500 font-bold mt-1 block">Manager: {owner}</span>
                      </div>
                    </div>
                    <button onClick={() => setRetentionsModalTeam(null)} className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1.5 hover:bg-white/5 rounded-lg border-0 bg-transparent">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Statistics */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center font-mono">
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Spent</span>
                      <span className="text-base font-black text-amber-400">
                        {fmtCr(totalCost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                      </span>
                    </div>
                    <div className="flex flex-col items-center border-l border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Remaining Purse</span>
                      <span className="text-base font-black text-emerald-400">
                        {fmtCr(remaining, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                      </span>
                    </div>
                  </div>

                  {/* Retained Players List */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left pl-1">Players ({breakdown.length})</h5>
                    
                    {breakdown.length === 0 ? (
                      <div className="p-8 rounded-xl bg-white/[0.01] border border-white/5 text-center text-slate-500 text-xs italic font-bold">
                        No players retained by this team
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {breakdown.map((player) => (
                          <div 
                            key={player.name}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 text-left">
                              <div 
                                className={`w-1.5 h-6 rounded-full shrink-0 ${player.isUncapped ? 'bg-emerald-400' : 'bg-amber-400'}`}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{player.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-none">{player.role}</span>
                                  {player.isOverseas && (
                                    <span className="text-[7px] font-black px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">OS</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono text-xs font-black text-white shrink-0">
                              {fmtCr(player.cost, roomState?.currency || 'inr', LEAGUE_DEFAULTS[activeLeague] || 'inr')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Info */}
                  <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-white/5">
                    <span>Capped: {breakdown.filter(p => !p.isUncapped).length}</span>
                    <span>Uncapped: {breakdown.filter(p => p.isUncapped).length}</span>
                    <span>Overseas: {breakdown.filter(p => p.isOverseas).length}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {/* Settings Modal */}
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#0a0f1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">Room Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Allow Watchers */}
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-bold text-white">Allow Watchers</div>
                      <div className="text-xs text-slate-500">Enable or disable spectators in the lobby</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                      {[
                        { id: true, label: 'Allowed', desc: 'Anyone can spectate' },
                        { id: false, label: 'Disabled', desc: 'No spectators' }
                      ].map((opt) => {
                        const isActive = localLobbySettings.allowSpectators === opt.id;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setLocalLobbySettings(prev => ({ ...prev, allowSpectators: opt.id }))}
                            className={`relative py-3 px-3 rounded-lg text-center transition-all overflow-hidden ${
                              isActive ? '' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeWatcherSettingBg"
                                className="absolute inset-0 rounded-lg bg-gradient-to-r"
                                style={{ 
                                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight || theme.accent})`
                                }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <div className={`relative z-10 flex flex-col items-center justify-center leading-none ${
                              isActive 
                                ? (theme.id === 'ipl' ? 'text-[#1a1205]' : 'text-white') 
                                : ''
                            }`}>
                              <span className="text-xs font-black uppercase tracking-wider">{opt.label}</span>
                              <span className={`text-[8px] font-bold ${isActive ? 'opacity-85' : 'text-slate-600'} mt-1`}>{opt.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Max Watchers */}
                  {localLobbySettings.allowSpectators && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-white">Max Watchers</div>
                        <span className="text-sm font-black" style={{ color: theme.accent }}>{localLobbySettings.maxSpectators}</span>
                      </div>
                      <input type="range" min="1" max="10"
                        value={localLobbySettings.maxSpectators}
                        onChange={(e) => setLocalLobbySettings(prev => ({ ...prev, maxSpectators: parseInt(e.target.value) }))}
                        className="w-full" />
                    </div>
                  )}

                  {/* Number of Teams */}
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-white">Number of Teams</div>
                    <div className={`grid ${activeLeague === 'sa20' || activeLeague === 'wpl' ? 'grid-cols-1' : 'grid-cols-2'} gap-2 p-1 bg-white/5 rounded-xl border border-white/5`}>
                      {(activeLeague === 'sa20' ? [6] : (activeLeague === 'wpl' ? [5] : [10, 15])).map((n) => {
                        const isActive = localLobbySettings.teamCount === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setLocalLobbySettings(prev => ({ ...prev, teamCount: n }))}
                            className={`relative py-3 px-3 rounded-lg text-center transition-all overflow-hidden ${
                              isActive ? '' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeTeamSettingBg"
                                className="absolute inset-0 rounded-lg bg-gradient-to-r"
                                style={{ 
                                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight || theme.accent})`
                                }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <div className={`relative z-10 flex flex-col items-center justify-center leading-none ${
                              isActive 
                                ? (theme.id === 'ipl' ? 'text-[#1a1205]' : 'text-white') 
                                : ''
                            }`}>
                              <span className="text-xs font-black uppercase tracking-wider">{n} Teams</span>
                              <span className={`text-[8px] font-bold ${isActive ? 'opacity-85' : 'text-slate-600'} mt-1`}>
                                {activeLeague === 'sa20' ? 'SA20 Limit' : activeLeague === 'wpl' ? 'WPL Limit' : `${n === 10 ? 'Standard' : 'Extended'} League`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowSettings(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-slate-400 hover:bg-white/10 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleUpdateLobbySettings}
                    className="flex-1 py-3 rounded-xl font-black text-sm transition-all"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentLight})`, color: theme.id === 'ipl' ? '#1a1205' : 'white' }}>
                    Save Settings
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Kick Confirmation */}
        {kickTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="w-full max-w-sm bg-[#0a0f1a] border border-red-500/20 rounded-2xl p-6 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-2xl">🚫</div>
                <div>
                  <h3 className="text-lg font-black text-white">Remove Player?</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Remove <span className="text-red-400 font-bold">{kickTarget.name}</span> from the room?
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setKickTarget(null)}
                  className="py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => { socket.emit("kick_player", { roomCode: roomState.roomCode, targetSocketId: kickTarget.socketId }); setKickTarget(null); }}
                  className="py-3 rounded-xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all">
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Leave Confirmation */}
        {showLeaveConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="w-full max-w-sm bg-[#0a0f1a] border border-white/10 rounded-2xl p-6 space-y-6">
              <div className="text-center space-y-3">
                <div className="text-4xl">👋</div>
                <div>
                  <h3 className="text-lg font-black text-white">Leave Room?</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {isPrimaryHost
                      ? "You're the host. Leaving will end this room for everyone."
                      : "You will be disconnected from this auction room."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowLeaveConfirm(false)}
                  className="py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all">
                  Stay
                </button>
                <button onClick={confirmLeaveRoom}
                  className="py-3 rounded-xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all">
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Rules & Features Slide-out Drawer */}
        {showRulesDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRulesDrawer(false)}
            className="fixed inset-0 z-[250] flex justify-end bg-black/65 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full bg-[#0b0f19] border-l border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center">
                      <img src={league.logoUrl} alt={league.label} className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: league.accent }}>{league.label} Rules</div>
                      <h3 className="text-sm font-black text-white mt-0.5">{league.subtitle}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRulesDrawer(false)}
                    className="p-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Rules Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: league.accent }} />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Auction Rules</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(league.rules).map(([key, val]) => (
                      <div key={key} className="flex flex-col p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          {key === 'squad' ? 'Squad Size' : key === 'overseas' ? 'Overseas' : key === 'bowling' ? 'Pure Bowlers' : key === 'keeping' ? 'Wicketkeepers' : key === 'uncapped' ? 'Uncapped' : key === 'domestic' ? 'SA Players' : 'U-23 Players'}
                        </span>
                        <span className="text-xs font-bold text-white">{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/15">
                    <p className="text-[10px] text-red-400 font-bold leading-normal">
                      ⚠️ Breaking these squad rules will disqualify your team at the end of the auction.
                    </p>
                  </div>
                </div>

                {/* Info Card / Specs */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" style={{ color: league.accent }} />
                    <span className="text-xs font-black text-white uppercase tracking-widest">League Features</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { icon: '⚡', title: 'Live Bidding', desc: 'Instant bid synchronization and real-time audio chat.' },
                      { icon: '👥', title: `Up to ${localLobbySettings?.teamCount || (league.id === 'sa20' ? 6 : league.id === 'wpl' ? 5 : 15)} Players`, desc: 'Full multiplayer room capabilities and active participant seats.' },
                    ].map((f) => (
                      <div key={f.title} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex gap-3">
                        <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                        <div>
                          <div className="text-xs font-black text-white">{f.title}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Close Action */}
              <div className="pt-6 border-t border-white/10 mt-8">
                <button
                  onClick={() => setShowRulesDrawer(false)}
                  className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-center transition-all hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${league.accent}, ${league.accentLight || league.accent})`,
                    color: league.id === 'ipl' ? '#1a1205' : 'white',
                    boxShadow: `0 4px 20px ${league.accentDim}`
                  }}
                >
                  I Understand, Let's Play!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
};

export default Lobby;
