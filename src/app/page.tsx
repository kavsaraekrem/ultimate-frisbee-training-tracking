"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase"; 

type Workout = {
  id?: number;
  type: string;
  amount: number;
  points: number;
  user_id: string;
  created_at?: string;
  player_name?: string;
};

type Challenge = {
  id: number;
  sender_id: string;
  receiver_id: string;
  workout_type: string;
  amount: number;
  status: string;
  created_at: string;
  sender_name?: string;
  receiver_name?: string;
  custom_title?: string;
};

type PlayerProfile = {
  id: string;
  display_name: string;
  streak_weeks: number;
  badges: string[];
  buddy_id: string | null;
  is_captain: boolean;
};

type PlaybookContent = {
  id?: number;
  week_title: string;
  week_notes: string;
  ultiplays_url: string;
  youtube_url: string;
  file_url: string;
  created_at?: string;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // 📖 "playbook" sekmesini hem mobile hem masaüstüne ekledik
  const [activeTab, setActiveTab] = useState<"home" | "challenges" | "stats" | "playbook" | "captain">("home");

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("Kum Antrenmanı");
  const [amount, setAmount] = useState("");
  const [currentLeaderboard, setCurrentLeaderboard] = useState<any[]>([]);
  const [lastWeekPodium, setLastWeekPodium] = useState<any[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [allPlayers, setAllPlayers] = useState<PlayerProfile[]>([]);
  const [activityFeed, setActivityFeed] = useState<Workout[]>([]);
  const [playerProfiles, setPlayerProfiles] = useState<{ [key: string]: PlayerProfile }>({});
  const [myProfile, setMyProfile] = useState<PlayerProfile | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [targetReceiverId, setTargetReceiverId] = useState("");
  const [challengeType, setChallengeType] = useState("Kum Antrenmanı");
  const [challengeAmount, setChallengeAmount] = useState("");
  const [customChallengeTitle, setCustomChallengeTitle] = useState("");

  // 📖 Playbook State'leri
  const [currentPlaybook, setCurrentPlaybook] = useState<PlaybookContent | null>(null);
  const [pWeekTitle, setPWeekTitle] = useState("");
  const [pWeekNotes, setPWeekNotes] = useState("");
  const [pUltiplaysUrl, setPUltiplaysUrl] = useState("");
  const [pYoutubeUrl, setPYoutubeUrl] = useState("");
  const [pFileUrl, setPFileUrl] = useState("");
  const [isSavingPlaybook, setIsSavingPlaybook] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      initApp();
    } else {
      setWorkouts([]);
      setCurrentLeaderboard([]);
      setLastWeekPodium([]);
      setDisplayName("");
      setChallenges([]);
      setActivityFeed([]);
      setMyProfile(null);
      setCurrentPlaybook(null);
    }
  }, [user]);

  const initApp = async () => {
    await fetchMyProfile();
    await checkExpiredChallenges(); 
    await fetchChallenges();
    await fetchWorkouts();
    await fetchLeaderboards();
    await fetchLatestPlaybook();
  };

  const fetchMyProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setDisplayName(data.display_name || "");
      setMyProfile(data as PlayerProfile);
    }
  };

  // 📖 Son yüklenen playbook taktiğini getir
  const fetchLatestPlaybook = async () => {
    const { data, error } = await supabase.from("playbook").select("*").order("id", { ascending: false }).limit(1);
    if (data && data.length > 0) {
      setCurrentPlaybook(data[0] as PlaybookContent);
      // Kaptan paneline mevcut bilgileri önceden dolduralım doldurmak kolay olsun diye
      setPWeekTitle(data[0].week_title || "");
      setPWeekNotes(data[0].week_notes || "");
      setPUltiplaysUrl(data[0].ultiplays_url || "");
      setPYoutubeUrl(data[0].youtube_url || "");
      setPFileUrl(data[0].file_url || "");
    }
  };

  // 📖 Kaptan için yeni Playbook yayınlama fonksiyonu
  const handleSavePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile?.is_captain) return;
    setIsSavingPlaybook(true);

    const { error } = await supabase.from("playbook").insert([{
      week_title: pWeekTitle,
      week_notes: pWeekNotes,
      ultiplays_url: pUltiplaysUrl,
      youtube_url: pYoutubeUrl,
      file_url: pFileUrl
    }]);

    setIsSavingPlaybook(false);
    if (error) {
      alert("Playbook yüklenirken hata oluştu: " + error.message);
    } else {
      alert("Kaptanım, yeni haftanın taktik playbook'u tüm takıma başarıyla duyuruldu! 📖🚀");
      fetchLatestPlaybook();
      setActiveTab("playbook");
    }
  };

  // YouTube Linkini Embed Formatına Çeviren Akıllı Yardımcı Fonksiyon
  const formatYoutubeEmbed = (url: string) => {
    if (!url) return "";
    if (url.includes("embed/")) return url;
    if (url.includes("v=")) {
      const id = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;
    setIsUpdatingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setIsUpdatingName(false);
    if (!error) {
      alert("İsmin başarıyla güncellendi.");
      initApp();
    }
  };

  const calculatePoints = (workoutType: string, amt: number) => {
    switch (workoutType) {
      case "Kum Antrenmanı": return amt * 12; 
      case "Başka Takımla Antrenman": return amt * 6;  
      case "Disk Atma (Throwing)": return Math.floor(amt / 30) * 4; 
      case "Kondisyon (Gym/Yüzme/Koşu vs.)": return Math.floor(amt / 30) * 3; 
      case "Aktif Dinlenme (Esnetme/Recovery)": return Math.floor(amt / 30) * 1; 
      case "Özel Meydan Okuma (Custom)": return 4; 
      default: return 0;
    }
  };

  const checkExpiredChallenges = async () => {
    const { data: activeChallenges } = await supabase.from("challenges").select("*").eq("status", "Beklemede");
    if (!activeChallenges) return;

    const now = new Date().getTime();
    const fortyEightHoursInMs = 48 * 60 * 60 * 1000;

    for (const c of activeChallenges) {
      const createdTime = new Date(c.created_at).getTime();
      if (now - createdTime > fortyEightHoursInMs) {
        await supabase.from("challenges").update({ status: "Süresi Doldu" }).eq("id", c.id);
        
        const penaltyPoints = c.workout_type === "Özel Meydan Okuma (Custom)" ? -2 : -3;
        const label = c.workout_type === "Özel Meydan Okuma (Custom)" 
          ? `❌ Düello Süresi Doldu (Ceza): ${c.custom_title}`
          : `❌ Meydan Okuma Süresi Doldu (Ceza): ${c.workout_type}`;

        await supabase.from("workouts").insert([{
          type: label,
          amount: c.amount,
          points: penaltyPoints,
          user_id: c.receiver_id
        }]);
      }
    }
  };

  const fetchChallenges = async () => {
    if (!user) return;
    const { data: cData } = await supabase.from("challenges").select("*").order("id", { ascending: false });
    const { data: pData } = await supabase.from("profiles").select("id, display_name");

    if (pData && cData) {
      const pMap: { [key: string]: string } = {};
      pData.forEach(p => pMap[p.id] = p.display_name || "Oyuncu");

      const enrichedChallenges = cData.map((c: any) => ({
        ...c,
        sender_name: pMap[c.sender_id] || "Bilinmeyen",
        receiver_name: pMap[c.receiver_id] || "Bilinmeyen"
      }));

      setChallenges(enrichedChallenges);
    }
  };

  const sendChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = challengeType === "Özel Meydan Okuma (Custom)" ? 1 : Number(challengeAmount);
    if (!user || !targetReceiverId || !amt || amt <= 0) return;
    if (challengeType === "Özel Meydan Okuma (Custom)" && !customChallengeTitle.trim()) {
      alert("Lütfen özel meydan okuma için bir görev tanımı yazın!");
      return;
    }

    const targetActiveCount = challenges.filter(c => c.receiver_id === targetReceiverId && c.status === "Beklemede").length;
    if (targetActiveCount >= 2) {
      alert("Bu oyuncunun şu an zaten 2 adet aktif meydan okuması var! Önce onları eritmeli. 🛡️");
      return;
    }

    const { error } = await supabase.from("challenges").insert([{
      sender_id: user.id,
      receiver_id: targetReceiverId,
      workout_type: challengeType,
      amount: amt,
      status: "Beklemede",
      custom_title: challengeType === "Özel Meydan Okuma (Custom)" ? customChallengeTitle : null
    }]);

    if (error) alert("Hata: " + error.message);
    else {
      alert("Meydan okuma başarıyla fırlatıldı! ⚔️");
      setChallengeAmount("");
      setCustomChallengeTitle("");
      fetchChallenges();
    }
  };

  const completeChallenge = async (c: Challenge) => {
    const { error: cError } = await supabase.from("challenges").update({ status: "Tamamlandı" }).eq("id", c.id);
    if (cError) return;

    let totalAwarded = 0;
    let label = "";

    if (c.workout_type === "Özel Meydan Okuma (Custom)") {
      totalAwarded = 4;
      label = `🏆 Özel Düello Başarıldı (+4 Puan): ${c.custom_title}`;
    } else {
      const basePoints = calculatePoints(c.workout_type, c.amount);
      totalAwarded = basePoints + 2; 
      label = `🏆 Challenge Başarıldı (${basePoints} + 2 Bonus): ${c.workout_type}`;
    }

    await supabase.from("workouts").insert([{
      type: label,
      amount: c.amount,
      points: totalAwarded,
      user_id: c.receiver_id
    }]);

    alert(`Tebrikler! Düelloyu kazandın ve ${totalAwarded} Puanı kaptın! 🥇`);
    initApp();
  };

  const getWeekRanges = () => {
    const now = new Date();
    const currentMonday = new Date(now);
    const day = currentMonday.getDay();
    const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1); 
    currentMonday.setDate(diff);
    currentMonday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(currentMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(currentMonday);
    lastSunday.setMilliseconds(-1); 
    return { currentMonday, lastMonday, lastSunday };
  };

  const fetchWorkouts = async () => {
    if (!user) return;
    const { data } = await supabase.from("workouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setWorkouts(data);
  };

  const getBuddyNameCombined = (uid: string, profileMap: { [key: string]: PlayerProfile }) => {
    const player = profileMap[uid];
    if (!player) return "Bilinmeyen";
    
    if (player.buddy_id && profileMap[player.buddy_id]) {
      const buddy = profileMap[player.buddy_id];
      return [player.display_name, buddy.display_name].sort().join(" & ");
    }
    return player.display_name;
  };

  const fetchLeaderboards = async () => {
    if (!user) return;
    const { data: workoutsData } = await supabase.from("workouts").select("*").order("created_at", { ascending: false });
    const { data: profilesData } = await supabase.from("profiles").select("*");
    const { data: badgesData } = await supabase.from("badges").select("*");

    if (profilesData) {
      setAllPlayers(profilesData as PlayerProfile[]);
      
      const profileMap: { [key: string]: PlayerProfile } = {};
      profilesData.forEach(p => {
        profileMap[p.id] = {
          id: p.id,
          display_name: p.display_name || "Oyuncu",
          streak_weeks: p.streak_weeks || 0,
          badges: [],
          buddy_id: p.buddy_id,
          is_captain: p.is_captain
        };
      });

      if (badgesData) {
        badgesData.forEach(b => {
          if (profileMap[b.user_id]) profileMap[b.user_id].badges.push(b.badge_type);
        });
      }

      if (workoutsData) {
        const enrichedActivity = workoutsData.map(w => ({
          ...w,
          player_name: profileMap[w.user_id]?.display_name || "Bilinmeyen Oyuncu"
        })).slice(0, 50);
        setActivityFeed(enrichedActivity);

        const { currentMonday, lastMonday, lastSunday } = getWeekRanges();
        
        const lastWeekBuddyMap: { [key: string]: number } = {};
        workoutsData.forEach((w) => {
          const workoutDate = new Date(w.created_at || "");
          if (workoutDate >= lastMonday && workoutDate <= lastSunday) {
            if (profileMap[w.user_id]) {
              const bName = getBuddyNameCombined(w.user_id, profileMap);
              lastWeekBuddyMap[bName] = (lastWeekBuddyMap[bName] || 0) + w.points;
            }
          }
        });

        const sortedLastWeek = Object.keys(lastWeekBuddyMap).map((bName) => ({
          name: bName,
          points: Number(lastWeekBuddyMap[bName].toFixed(1)),
        })).sort((a, b) => b.points - a.points).slice(0, 3);

        setLastWeekPodium(sortedLastWeek);

        const currentWeekBuddyMap: { [key: string]: number } = {};
        const currentWeekBuddyBadges: { [key: string]: string[] } = {};
        const currentWeekBuddyIsMe: { [key: string]: boolean } = {};

        Object.keys(profileMap).forEach((uid) => {
          const bName = getBuddyNameCombined(uid, profileMap);
          if (!currentWeekBuddyMap[bName]) currentWeekBuddyMap[bName] = 0;
          if (!currentWeekBuddyBadges[bName]) currentWeekBuddyBadges[bName] = [];
          
          profileMap[uid].badges.forEach(badge => {
            if (!currentWeekBuddyBadges[bName].includes(badge)) {
              currentWeekBuddyBadges[bName].push(badge);
            }
          });

          if (uid === user.id) {
            currentWeekBuddyIsMe[bName] = true;
          }
        });

        workoutsData.forEach((w) => {
          const workoutDate = new Date(w.created_at || "");
          if (workoutDate >= currentMonday) {
            if (profileMap[w.user_id]) {
              const bName = getBuddyNameCombined(w.user_id, profileMap);
              currentWeekBuddyMap[bName] = (currentWeekBuddyMap[bName] || 0) + w.points;
            }
          }
        });

        const sortedCurrent = Object.keys(currentWeekBuddyMap).map((bName) => ({
          name: bName,
          points: Number(currentWeekBuddyMap[bName].toFixed(1)),
          isMe: !!currentWeekBuddyIsMe[bName],
          badges: currentWeekBuddyBadges[bName]
        })).sort((a, b) => b.points - a.points);

        setCurrentLeaderboard(sortedCurrent);
        setPlayerProfiles(profileMap);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.auth.signInWithPassword({ email, password });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const assignBuddy = async (playerAId: string, playerBId: string | null) => {
    if (!myProfile?.is_captain) return;

    if (!playerBId) {
      const currentBuddyId = playerProfiles[playerAId]?.buddy_id;
      await supabase.from("profiles").update({ buddy_id: null }).eq("id", playerAId);
      if (currentBuddyId) {
        await supabase.from("profiles").update({ buddy_id: null }).eq("id", currentBuddyId);
      }
    } else {
      await supabase.from("profiles").update({ buddy_id: playerBId }).eq("id", playerAId);
      await supabase.from("profiles").update({ buddy_id: playerAId }).eq("id", playerBId);
    }
    
    alert("Kaptanım, Buddy eşleşmesi başarıyla güncellendi! 🫡");
    initApp();
  };

  const addWorkout = async () => {
    if (!user) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    if (type === "Kum Antrenmanı" && numericAmount > 1) {
      alert("🚨 Limit Aşımı: Bir günde en fazla 1 adet Kum Antrenmanı girebilirsiniz.");
      return;
    }
    if (type === "Başka Takımla Antrenman" && numericAmount > 1) {
      alert("🚨 Limit Aşımı: Bir günde en fazla 1 adet Başka Takımla Antrenman girebilirsiniz.");
      return;
    }
    if ((type === "Disk Atma (Throwing)" || type === "Kondisyon (Gym/Yüzme/Koşu vs.)") && numericAmount > 180) {
      alert("🚨 Limit Aşımı: Bu antrenman türü için bir günde en fazla 180 dakika (3 saat) giriş yapabilirsiniz.");
      return;
    }
    if (type === "Aktif Dinlenme (Esnetme/Recovery)" && numericAmount > 60) {
      alert("🚨 Limit Aşımı: Vücudun tam toparlanması için Aktif Dinlenme süresi günde en fazla 60 dakika olarak sınırlandırılmıştır.");
      return;
    }

    const todayName = new Date().toLocaleDateString("tr-TR", { weekday: "long" });
    const { currentMonday } = getWeekRanges();
    const mondayStr = currentMonday.toISOString().split("T")[0];

    const isHeavy = !type.includes("Recovery");

    if (isHeavy) {
      const { data: att } = await supabase.from("weekly_attendance")
        .select("workout_day")
        .eq("user_id", user.id)
        .eq("week_start_date", mondayStr)
        .eq("is_heavy", true);

      const uniqueDays = att ? new Set(att.map(a => a.workout_day)) : new Set<string>();

      if (uniqueDays.size >= 5 && !uniqueDays.has(todayName)) {
        alert("🚨 DUR VE DİNLEN! Haftalık 5 günlük ağır yüklenme sınırına ulaştın. Vücudunun toparlanması için bugün dinlenmelisin. 🛌 Ancak 'Aktif Dinlenme (Recovery)' seçeneğini hala girebilirsin!");
        return;
      }
    }

    let points = calculatePoints(type, numericAmount);
    const { data } = await supabase.from("workouts").insert([{ type, amount: numericAmount, points, user_id: user.id }]).select();
    
    if (data) {
      await supabase.from("weekly_attendance").insert([{
        user_id: user.id,
        workout_day: todayName,
        is_heavy: isHeavy,
        week_start_date: mondayStr
      }]);

      setAmount("");
      initApp();
    }
  };

  const deleteWorkout = async (id: number) => {
    const confirmDelete = window.confirm("Bu antrenman kaydını silmek istediğinize emin misiniz? Puanınız geri düşecektir. 🗑️");
    if (!confirmDelete) return;

    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) initApp();
  };

  const totalPoints = workouts.reduce((sum, w) => sum + w.points, 0);

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
          <span className="text-4xl inline-block animate-bounce mb-2">🥏</span>
          <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-6">Ultimate Frisbee Team</h1>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4 text-left">
            <input type="email" placeholder="isim@takim.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold p-3 rounded-xl">{isRegistering ? "Kayıt Ol" : "Giriş Yap"}</button>
          </form>
          <p className="text-sm text-slate-500 mt-6">{isRegistering ? "Zaten üye misin?" : "Hesabın yok mu?"} <span onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 cursor-pointer ml-1">{isRegistering ? "Giriş Yap" : "Kayıt Ol"}</span></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-4 flex flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl">🥏</span>
            <div>
              <h1 className="text-base md:text-xl font-extrabold text-white">FRİZBİ HUB</h1>
              <p className="text-[10px] md:text-xs text-slate-400">Oyuncu Paneli {myProfile?.is_captain && "• 👑 KAPTAN"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Masaüstü Üst Menü Linkleri */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              <button onClick={() => setActiveTab("home")} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === "home" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>Ana Sayfa</button>
              <button onClick={() => setActiveTab("playbook")} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === "playbook" ? "bg-cyan-950 text-cyan-400 border border-cyan-800" : "text-slate-400 hover:text-white"}`}>📖 Playbook</button>
            </div>

            {myProfile?.is_captain && (
              <button onClick={() => setActiveTab("captain")} className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${activeTab === "captain" ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-amber-950/40 text-amber-400 border-amber-900"}`}>👑 Kaptan Paneli</button>
            )}
            <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs md:text-sm transition-all">Çıkış</button>
          </div>
        </header>

        {/* 👑 KAPTAN GENİŞLETİLMİŞ YÖNETİM PANELİ */}
        {myProfile?.is_captain && activeTab === "captain" && (
          <div className="space-y-6">
            {/* BUDDY BAĞLAMA FORMU */}
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">👑 TAKIM BUDDY (ORTAKLIK) MERKEZİ</h2>
                <p className="text-xs text-slate-400 mt-1">Kaptanım, bu alandan oyuncuları birbiriyle eşleştirebilirsin.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-2">
                {allPlayers.map((player) => (
                  <div key={player.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-white text-sm">{player.display_name || "İsimsiz Oyuncu"}</p>
                      <p className="text-[11px] text-amber-400/80 mt-0.5">Ortağı: <span className="font-bold underline">{player.buddy_id ? (playerProfiles[player.buddy_id]?.display_name || "Yükleniyor...") : "Yok"}</span></p>
                    </div>
                    <select
                      value={player.buddy_id || ""}
                      onChange={(e) => assignBuddy(player.id, e.target.value === "" ? null : e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-xl text-xs"
                    >
                      <option value="">Ortağı Yok (Tek Yarışsın)</option>
                      {allPlayers.filter(p => p.id !== player.id).map(p => (
                        <option key={p.id} value={p.id}>{p.display_name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* 📖 YENİ TAKTİK & PLAYBOOK YÜKLEME FORMU */}
            <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-lg font-black text-cyan-400 flex items-center gap-2">📖 HAFTALIK TAKTİK & PLAYBOOK YAYINLA</h2>
                <p className="text-xs text-slate-400 mt-1">Buraya girdiğin taktik notları, Ultiplays animasyonları ve videolar anında tüm takımın telefonundaki Playbook sekmesine düşer.</p>
              </div>
              <form onSubmit={handleSavePlaybook} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Hafta Başlığı</label>
                  <input type="text" placeholder="Örn: 3. Hafta: Zone Savunma ve Cup Yerleşim Mantığı" value={pWeekTitle} onChange={(e) => setPWeekTitle(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">🎯 Haftanın Odak Noktaları ve Antrenman Notları</label>
                  <textarea rows={5} placeholder="Bu hafta antrenmanda tam olarak neye odaklanacağız? Adım adım detayları yazın..." value={pWeekNotes} onChange={(e) => setPWeekNotes(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none leading-relaxed" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Ultiplays Paylaşım/Embed Linki</label>
                    <input type="url" placeholder="https://ultiplays.com/playbook/..." value={pUltiplaysUrl} onChange={(e) => setPUltiplaysUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">YouTube Video Linki (Opsiyonel)</label>
                    <input type="url" placeholder="https://www.youtube.com/watch?v=..." value={pYoutubeUrl} onChange={(e) => setPYoutubeUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Ek Dosya / PDF / Fotoğraf Linki (Opsiyonel)</label>
                    <input type="url" placeholder="Bulut veya Drive dosya linki" value={pFileUrl} onChange={(e) => setPFileUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setActiveTab("home")} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl font-bold">İptal</button>
                  <button type="submit" disabled={isSavingPlaybook} className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black px-6 py-2 rounded-xl shadow-lg">{isSavingPlaybook ? "Yayınlanıyor..." : "Taktikleri Takıma Fırlat 🚀"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 📖 YENİ PLAYBOOK GÖRÜNTÜLEME SEKME ALANI (RESPONSIVE) */}
        {activeTab === "playbook" && (
          <div className="space-y-6">
            {!currentPlaybook ? (
              <div className="bg-slate-900 border border-slate-800 p-12 text-center rounded-2xl">
                <span className="text-4xl block mb-2">📖</span>
                <p className="text-slate-400 text-sm">Kaptanınız henüz bu haftanın taktik playbook içeriklerini yüklemedi.</p>
              </div>
            ) : (
              <div>
                {/* Masaüstü Düzeni (Yan Yana) */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-6">
                  {/* Sol Taraf: Ultiplays Taktik Tahtası (Geniş Ekran) */}
                  <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[600px]">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">🎬 ULTIPLAYS CANLI TAKTİK ANİMASYONU</h3>
                    {currentPlaybook.ultiplays_url ? (
                      <iframe src={currentPlaybook.ultiplays_url} className="w-full flex-1 rounded-xl bg-slate-950 border border-slate-800" allowFullScreen></iframe>
                    ) : (
                      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-600">Bu hafta için Ultiplays çizimi yüklenmedi.</div>
                    )}
                  </div>
                  {/* Sağ Taraf: Notlar ve Diğer Maddeler */}
                  <div className="lg:col-span-5 space-y-6 max-h-[600px] overflow-y-auto pr-1">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">BU HAFTANIN ODAĞI</span>
                        <h2 className="text-xl font-black text-white mt-1">{currentPlaybook.week_title}</h2>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{currentPlaybook.week_notes}</p>
                    </div>
                    {currentPlaybook.youtube_url && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">📺 TAKTİK ANALİZ VİDEOSU</h4>
                        <iframe src={formatYoutubeEmbed(currentPlaybook.youtube_url)} className="w-full aspect-video rounded-xl bg-slate-950" allowFullScreen></iframe>
                      </div>
                    )}
                    {currentPlaybook.file_url && (
                      <a href={currentPlaybook.file_url} target="_blank" rel="noreferrer" className="block bg-gradient-to-r from-cyan-950 to-slate-900 border border-cyan-800 hover:border-cyan-500 p-4 rounded-2xl text-center text-sm font-bold text-cyan-400 transition-all">📂 Bu Haftanın Ek Dökümanını / PDF Dosyasını Aç</a>
                    )}
                  </div>
                </div>

                {/* Mobil Düzeni (Kaptanın İstediği Sıralama: Odak Noktası ➔ Ultiplays ➔ Video/Dosya) */}
                <div className="block lg:hidden space-y-6">
                  {/* 1. Sırada: Odak Noktalarımız ve Notlar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="border-b border-slate-800 pb-2">
                      <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">BU HAFTANIN ODAĞI</span>
                      <h2 className="text-lg font-black text-white mt-0.5">{currentPlaybook.week_title}</h2>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{currentPlaybook.week_notes}</p>
                  </div>

                  {/* 2. Sırada: Ultiplays Taktik Tahtası */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">🎬 ULTIPLAYS TAKTİK ANİMASYONU</h3>
                    {currentPlaybook.ultiplays_url ? (
                      <iframe src={currentPlaybook.ultiplays_url} className="w-full h-[320px] rounded-xl bg-slate-950 border border-slate-800" allowFullScreen></iframe>
                    ) : (
                      <p className="text-xs text-slate-600 italic py-4 text-center">Bu hafta için Ultiplays çizimi yüklenmedi.</p>
                    )}
                  </div>

                  {/* 3. Sırada: Diğer Maddeler (YouTube Videosu ve Dosyalar) */}
                  {currentPlaybook.youtube_url && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">📺 TAKTİK ANALİZ VİDEOSU</h4>
                      <iframe src={formatYoutubeEmbed(currentPlaybook.youtube_url)} className="w-full aspect-video rounded-xl bg-slate-950" allowFullScreen></iframe>
                    </div>
                  )}
                  {currentPlaybook.file_url && (
                    <a href={currentPlaybook.file_url} target="_blank" rel="noreferrer" className="block bg-slate-900 border border-slate-800 p-4 rounded-xl text-center text-xs font-bold text-cyan-400">📂 Bu Haftanın Ek Dökümanını / PDF Dosyasını Aç</a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KÜRSÜ (YALNIZCA ANA SAYFADA) */}
        {lastWeekPodium.length > 0 && (activeTab === "home") && (
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-slate-800 rounded-2xl p-4 md:p-6 text-center">
            <h3 className="text-[10px] md:text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">🏆 GEÇEN HAFTANIN EN İYİ EKİPLERİ (KÜRSÜ)</h3>
            <div className="flex justify-center items-end gap-2 md:gap-4 pt-2">
              {lastWeekPodium[1] && <div className="bg-slate-900/80 border border-slate-700 p-3 rounded-xl w-28 md:w-48 h-24 md:h-28 flex flex-col justify-center order-1 text-xs"><span className="text-sm md:text-base">🥈</span><p className="font-bold truncate">{lastWeekPodium[1].name}</p><p className="text-slate-400 text-[11px] md:text-sm">{lastWeekPodium[1].points} P</p></div>}
              {lastWeekPodium[0] && <div className="bg-slate-900 border-2 border-amber-500 p-3 rounded-xl w-32 md:w-56 h-30 md:h-36 flex flex-col justify-center order-2 text-xs md:text-sm"><span className="animate-bounce text-base md:text-xl">👑</span><p className="text-amber-400 font-black truncate">{lastWeekPodium[0].name}</p><p className="text-white font-black text-sm md:text-lg">{lastWeekPodium[0].points} P</p></div>}
              {lastWeekPodium[2] && <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl w-28 md:w-48 h-20 md:h-24 flex flex-col justify-center order-3 text-xs"><span className="text-sm md:text-base">🥉</span><p className="font-bold truncate">{lastWeekPodium[2].name}</p><p className="text-amber-700 text-[11px] md:text-xs">{lastWeekPodium[2].points} P</p></div>}
            </div>
          </div>
        )}

        {/* DÜELLO ALANI */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${activeTab === "challenges" ? "block" : "hidden md:grid"}`}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
            <h3 className="text-xs md:text-sm font-bold text-red-400 uppercase tracking-widest mb-4">⚔️ DÜELLO TEKLİF ET</h3>
            <form onSubmit={sendChallenge} className="space-y-3">
              <select value={targetReceiverId} onChange={(e) => setTargetReceiverId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs md:text-sm text-white focus:outline-none">
                <option value="">Kime Meydan Okuyorsun?</option>
                {allPlayers.filter(p => p.id !== user.id).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={challengeType} onChange={(e) => setChallengeType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none">
                  <option>Kum Antrenmanı</option>
                  <option>Başka Takımla Antrenman</option>
                  <option>Disk Atma (Throwing)</option>
                  <option>Kondisyon (Gym/Yüzme/Koşu vs.)</option>
                  <option>Aktif Dinlenme (Esnetme/Recovery)</option>
                  <option>Özel Meydan Okuma (Custom)</option>
                </select>
                
                {challengeType === "Özel Meydan Okuma (Custom)" ? (
                  <input type="text" placeholder="Görev Tanımı (Örn: 50 Şınav)" value={customChallengeTitle} onChange={(e) => setCustomChallengeTitle(e.target.value)} required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none" />
                ) : (
                  <input type="number" placeholder={challengeType.includes("Antrenman") ? "Katılım Adedi" : "Süre (Dakika)"} value={challengeAmount} onChange={(e) => setChallengeAmount(e.target.value)} required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none" />
                )}
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold p-3 rounded-xl text-xs md:text-sm transition-all">Meydan Okumayı Ateşle 🔥</button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
            <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">🛡️ TAKIMDAKİ DÜELLOLAR</h3>
            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {challenges.map(c => {
                const isReceived = c.receiver_id === user.id && c.status === "Beklemede";
                return (
                  <div key={c.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="text-slate-300 font-bold truncate">⚔️ {c.sender_name} ➔ {c.receiver_name}</p>
                      <p className="text-red-400 mt-0.5 font-semibold uppercase text-[11px]">GÖREV: {c.workout_type === "Özel Meydan Okuma (Custom)" ? c.custom_title : `${c.amount} ${c.workout_type.includes("Antrenman") ? "Kez" : "Dk"} ${c.workout_type}`}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mt-1 font-bold ${c.status === "Beklemede" ? "bg-amber-950 text-amber-400" : c.status === "Tamamlandı" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>{c.status === "Beklemede" ? "Savaş Devam Ediyor" : c.status}</span>
                    </div>
                    {isReceived && (
                      <button onClick={() => completeChallenge(c)} className="bg-emerald-500 text-slate-950 font-black px-3 py-2 rounded-xl shrink-0 transition-all">Yaptım 🥇</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ANA TAB GÖSTERİM ALANLARI */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${activeTab === "home" || activeTab === "stats" ? "grid" : "hidden lg:grid"}`}>
          
          {/* SÜTUN 1: ANTRENMAN İŞLEME */}
          <div className={`lg:col-span-4 space-y-6 ${activeTab === "home" ? "block" : "hidden lg:block"}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Profil Ayarları</h3>
              <form onSubmit={handleUpdateName} className="flex gap-2">
                <input type="text" placeholder="Ad Soyad" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} required className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none" />
                <button type="submit" disabled={isUpdatingName} className="bg-slate-800 text-white px-3 rounded-xl text-xs border border-slate-700">{isUpdatingName ? "..." : "Kaydet"}</button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KİŞİSEL TOPLAM SKORUN</p>
                <h2 className="text-2xl font-black text-white mt-0.5">{totalPoints.toFixed(1)} <span className="text-xs font-bold text-cyan-400">Puan</span></h2>
              </div>
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none">
                  <option>Kum Antrenmanı</option>
                  <option>Başka Takımla Antrenman</option>
                  <option>Disk Atma (Throwing)</option>
                  <option>Kondisyon (Gym/Yüzme/Koşu vs.)</option>
                  <option>Aktif Dinlenme (Esnetme/Recovery)</option>
                </select>
                <input type="number" placeholder={type.includes("Antrenman") ? "Katılım Adedi" : "Süre (Dakika)"} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none" />
                <button onClick={addWorkout} className="w-full bg-emerald-500 text-slate-950 font-bold p-2.5 rounded-xl text-xs transition-all">Antrenman İşle</button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Senin Kayıtların</h3>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 text-xs">
                {workouts.map((w) => (
                  <div key={w.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{w.type}</p>
                      <p className="text-[10px] text-slate-500">{w.type.includes("Antrenman") || w.type.includes("Düello") ? `${w.amount} Kez` : `${w.amount} Dk`}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-extrabold px-1.5 py-0.5 rounded ${w.points >= 0 ? "text-cyan-400 bg-cyan-950/40" : "text-red-400 bg-red-950/40"}`}>{w.points >= 0 ? `+${w.points}` : w.points}</span>
                      <button onClick={() => w.id && deleteWorkout(w.id)} className="text-slate-600 hover:text-red-400 text-[10px]">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SÜTUN 2: LİDERLİK SIRALAMASI */}
          <div className={`lg:col-span-4 ${activeTab === "stats" ? "block" : "hidden lg:block"}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl sticky top-8">
              <div className="text-center mb-5 pb-3 border-b border-slate-800">
                <span className="text-2xl block mb-0.5">⚡</span>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">BU HAFTANIN YARIŞI (BUDDY LİGİ)</h3>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {currentLeaderboard.map((player, index) => (
                  <div key={index} className={`flex flex-col p-2.5 rounded-xl border text-xs ${player.isMe ? "bg-emerald-950/20 border-emerald-500/40" : "bg-slate-950/40 border-slate-800/60"}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 text-[10px] font-bold bg-slate-800 rounded flex items-center justify-center text-slate-400 shrink-0">{index + 1}</span>
                        <span className={`truncate ${player.isMe ? "text-emerald-400 font-bold" : "text-slate-300"}`}>{player.name}</span>
                      </div>
                      <span className="font-black text-white">{player.points} <span className="text-[9px] font-normal text-slate-500">P</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SÜTUN 3: AKTİVİTE DUVARI */}
          <div className={`lg:col-span-4 mt-6 lg:mt-0 ${activeTab === "stats" ? "block" : "hidden lg:block"}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-full flex flex-col">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <span className="animate-pulse w-2 h-2 rounded-full bg-cyan-400 inline-block"></span>
                🔥 TAKIM AKTİVİTE DUVARI (CANLI)
              </h3>
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[460px] pr-1 text-xs">
                {activityFeed.map((act, idx) => (
                  <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-200 truncate">{act.player_name}</span>
                      <span className={`font-black shrink-0 px-1.5 py-0.5 rounded text-[10px] ${act.points >= 0 ? "text-emerald-400 bg-emerald-950/50" : "text-red-400 bg-red-950/50"}`}>{act.points >= 0 ? `+${act.points}` : act.points} P</span>
                    </div>
                    <p className="text-slate-400 text-[11px] italic">{act.type.includes("🏆") || act.type.includes("❌") ? "" : `🏃‍♂️ ${act.amount} ${act.type.includes("Antrenman") ? "Kez" : "Dk"} `}{act.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MOBİL ALT MENÜ (DÖRT SEKMELİ HALE GETİRİLDİ) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 px-4 py-2 flex justify-around items-center z-50 shadow-2xl">
        <button onClick={() => setActiveTab("home")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "home" ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
          <span className="text-lg">🏠</span>
          <span className="text-[9px]">Ana Sayfa</span>
        </button>
        
        <button onClick={() => setActiveTab("playbook")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "playbook" ? "text-cyan-400 font-bold" : "text-slate-400"}`}>
          <span className="text-lg">📖</span>
          <span className="text-[9px]">Playbook</span>
        </button>

        <button onClick={() => setActiveTab("challenges")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "challenges" ? "text-red-400 font-bold" : "text-slate-400"}`}>
          <span className="text-lg">⚔️</span>
          <span className="text-[9px]">Düellolar</span>
        </button>
        
        <button onClick={() => setActiveTab("stats")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "stats" ? "text-slate-200 font-bold" : "text-slate-400"}`}>
          <span className="text-lg">📈</span>
          <span className="text-[9px]">Sıralama</span>
        </button>
      </div>
    </main>
  );
}