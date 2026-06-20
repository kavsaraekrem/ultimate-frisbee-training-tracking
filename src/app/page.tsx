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
};

type PlayerProfile = {
  id: string;
  display_name: string;
  streak_weeks: number;
  badges: string[];
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Mobil Sekme Yönetimi ('home', 'challenges', 'stats')
  const [activeTab, setActiveTab] = useState<"home" | "challenges" | "stats">("home");

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("Kum Antrenmanı");
  const [amount, setAmount] = useState("");
  const [currentLeaderboard, setCurrentLeaderboard] = useState<any[]>([]);
  const [lastWeekPodium, setLastWeekPodium] = useState<any[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [allPlayers, setAllPlayers] = useState<{ id: string; display_name: string }[]>([]);
  const [activityFeed, setActivityFeed] = useState<Workout[]>([]);
  const [playerProfiles, setPlayerProfiles] = useState<{ [key: string]: PlayerProfile }>({});

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [targetReceiverId, setTargetReceiverId] = useState("");
  const [challengeType, setChallengeType] = useState("Kum Antrenmanı");
  const [challengeAmount, setChallengeAmount] = useState("");

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
    }
  }, [user]);

  const initApp = async () => {
    await fetchMyProfile();
    await checkExpiredChallenges(); 
    await fetchChallenges();
    await fetchWorkouts();
    await fetchLeaderboards();
  };

  const fetchMyProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    if (data) setDisplayName(data.display_name);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;
    setIsUpdatingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setIsUpdatingName(false);
    if (!error) {
      alert("İsmin başarıyla güncellendi.");
      fetchLeaderboards();
    }
  };

  const calculatePoints = (workoutType: string, amt: number) => {
    switch (workoutType) {
      case "Kum Antrenmanı": return amt * 10; 
      case "Başka Takımla Antrenman": return amt * 6;  
      case "Disk Atma (Throwing)": return Math.floor(amt / 30) * 4; 
      case "Kondisyon (Gym/Yüzme/Koşu vs.)": return Math.floor(amt / 30) * 3; 
      case "Aktif Dinlenme (Esnetme/Recovery)": return Math.floor(amt / 30) * 1; 
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
        await supabase.from("workouts").insert([{
          type: `❌ Meydan Okuma Süresi Doldu (Ceza): ${c.workout_type}`,
          amount: c.amount,
          points: -3,
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
    const amt = Number(challengeAmount);
    if (!user || !targetReceiverId || !amt || amt <= 0) return;

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
      status: "Beklemede"
    }]);

    if (error) alert("Hata: " + error.message);
    else {
      alert("Meydan okuma başarıyla fırlatıldı! ⚔️");
      setChallengeAmount("");
      fetchChallenges();
    }
  };

  const completeChallenge = async (c: Challenge) => {
    const { error: cError } = await supabase.from("challenges").update({ status: "Tamamlandı" }).eq("id", c.id);
    if (cError) return;

    const basePoints = calculatePoints(c.workout_type, c.amount);
    const totalAwarded = basePoints + 2; 
    const label = `🏆 Challenge Başarıldı (${basePoints} + 2 Bonus): ${c.workout_type}`;

    await supabase.from("workouts").insert([{
      type: label,
      amount: c.amount,
      points: totalAwarded,
      user_id: c.receiver_id
    }]);

    const { data: myDoneChallenges } = await supabase.from("challenges")
      .select("status")
      .eq("receiver_id", c.receiver_id)
      .order("id", { ascending: false })
      .limit(3);

    if (myDoneChallenges && myDoneChallenges.length === 3 && myDoneChallenges.every(ch => ch.status === "Tamamlandı")) {
      await supabase.from("badges").insert([{ user_id: c.receiver_id, badge_type: "🎯 Düello Avcısı" }]).select();
    }

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

  const fetchLeaderboards = async () => {
    if (!user) return;
    const { data: workoutsData } = await supabase.from("workouts").select("*").order("created_at", { ascending: false });
    const { data: profilesData } = await supabase.from("profiles").select("*");
    const { data: badgesData } = await supabase.from("badges").select("*");

    if (profilesData) {
      setAllPlayers(profilesData.filter(p => p.id !== user.id));
      
      const profileMap: { [key: string]: PlayerProfile } = {};
      profilesData.forEach(p => {
        profileMap[p.id] = {
          id: p.id,
          display_name: p.display_name || "Oyuncu",
          streak_weeks: p.streak_weeks || 0,
          badges: []
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
        const currentWeekMap: { [key: string]: number } = {};
        const lastWeekMap: { [key: string]: number } = {};

        workoutsData.forEach((w) => {
          const workoutDate = new Date(w.created_at || "");
          if (workoutDate >= currentMonday) {
            currentWeekMap[w.user_id] = (currentWeekMap[w.user_id] || 0) + w.points;
          }
          if (workoutDate >= lastMonday && workoutDate <= lastSunday) {
            lastWeekMap[w.user_id] = (lastWeekMap[w.user_id] || 0) + w.points;
          }
        });

        const sortedLastWeek = Object.keys(lastWeekMap).map((uid) => ({
          id: uid,
          name: profileMap[uid]?.display_name || `Oyuncu`,
          points: Number(lastWeekMap[uid].toFixed(1)),
        })).sort((a, b) => b.points - a.points).slice(0, 3); 

        setLastWeekPodium(sortedLastWeek);

        if (sortedLastWeek[0] && profileMap[sortedLastWeek[0].id]) profileMap[sortedLastWeek[0].id].badges.push("👑 MVP");
        if (sortedLastWeek[1] && profileMap[sortedLastWeek[1].id]) profileMap[sortedLastWeek[1].id].badges.push("🥈 Podyum");
        if (sortedLastWeek[2] && profileMap[sortedLastWeek[2].id]) profileMap[sortedLastWeek[2].id].badges.push("🥉 Podyum");

        const currentWeekAttendance: { [key: string]: Set<string> } = {};
        const recoveryCountMap: { [key: string]: number } = {};

        workoutsData.forEach(w => {
          const wDate = new Date(w.created_at || "");
          const dayName = wDate.toLocaleDateString("tr-TR", { weekday: "long" });
          
          if (wDate >= currentMonday) {
            if (!currentWeekAttendance[w.user_id]) currentWeekAttendance[w.user_id] = new Set();
            currentWeekAttendance[w.user_id].add(dayName);
          }

          if (w.type.includes("Recovery")) {
            recoveryCountMap[w.user_id] = (recoveryCountMap[w.user_id] || 0) + 1;
          }
        });

        Object.keys(recoveryCountMap).forEach(async (uid) => {
          if (recoveryCountMap[uid] >= 8) {
            const hasBadge = profileMap[uid]?.badges.includes("🧘‍♂️ Recovery Ustası");
            if (!hasBadge) {
              await supabase.from("badges").insert([{ user_id: uid, badge_type: "🧘‍♂️ Recovery Ustası" }]);
            }
          }
        });

        Object.keys(currentWeekAttendance).forEach(async (uid) => {
          if (currentWeekAttendance[uid].size >= 4) {
            if (profileMap[uid] && profileMap[uid].streak_weeks >= 4) {
              const hasBadge = profileMap[uid]?.badges.includes("🦾 İstikrar Abidesi");
              if (!hasBadge) {
                await supabase.from("badges").insert([{ user_id: uid, badge_type: "🦾 İstikrar Abidesi" }]);
              }
            }
          }
        });

        const sortedCurrent = Object.keys(profileMap).map((uid) => ({
          id: uid,
          name: profileMap[uid].display_name,
          points: Number((currentWeekMap[uid] || 0).toFixed(1)),
          isMe: uid === user.id,
          badges: profileMap[uid].badges
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

  const addWorkout = async () => {
    if (!user) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

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
        alert("🚨 DUR VE DİNLEN! Haftalık 5 günlük ağır yüklenme sınırına ulaştın. Vücudunun toparlanması ve kaslarının güçlenmesi için bugün dinlenmelisin. 🛌 Ancak istersen 'Aktif Dinlenme (Recovery)' seçeneğini hala girebilirsin!");
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
              <p className="text-[10px] md:text-xs text-slate-400">Oyuncu Paneli</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs md:text-sm transition-all">Çıkış</button>
        </header>

        {/* KÜRSÜ (Masaüstünde hep görünür, mobilde sadece Ana Sayfa sekmesinde) */}
        {lastWeekPodium.length > 0 && (activeTab === "home") && (
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-slate-800 rounded-2xl p-4 md:p-6 text-center">
            <h3 className="text-[10px] md:text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">🏆 GEÇEN HAFTANIN EN İYİLERİ (KÜRSÜ)</h3>
            <div className="flex justify-center items-end gap-2 md:gap-4 pt-2">
              {lastWeekPodium[1] && <div className="bg-slate-900/80 border border-slate-700 p-3 rounded-xl w-28 md:w-40 h-24 md:h-28 flex flex-col justify-center order-1 text-xs"><span className="text-sm md:text-base">🥈</span><p className="font-bold truncate">{lastWeekPodium[1].name}</p><p className="text-slate-400 text-[11px] md:text-sm">{lastWeekPodium[1].points} P</p></div>}
              {lastWeekPodium[0] && <div className="bg-slate-900 border-2 border-amber-500 p-3 rounded-xl w-32 md:w-44 h-30 md:h-36 flex flex-col justify-center order-2 text-xs md:text-sm"><span className="animate-bounce text-base md:text-xl">👑</span><p className="text-amber-400 font-black truncate">{lastWeekPodium[0].name}</p><p className="text-white font-black text-sm md:text-lg">{lastWeekPodium[0].points} P</p></div>}
              {lastWeekPodium[2] && <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl w-28 md:w-40 h-20 md:h-24 flex flex-col justify-center order-3 text-xs"><span className="text-sm md:text-base">🥉</span><p className="font-bold truncate">{lastWeekPodium[2].name}</p><p className="text-amber-700 text-[11px] md:text-xs">{lastWeekPodium[2].points} P</p></div>}
            </div>
          </div>
        )}

        {/* ⚔️ DÜELLO ALANI (Masaüstünde açık, Mobilde sekme kontrolünde) */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${activeTab === "challenges" ? "block" : "hidden md:grid"}`}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
            <h3 className="text-xs md:text-sm font-bold text-red-400 uppercase tracking-widest mb-4">⚔️ DÜELLO TEKLİF ET</h3>
            <form onSubmit={sendChallenge} className="space-y-3">
              <select value={targetReceiverId} onChange={(e) => setTargetReceiverId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs md:text-sm text-white focus:outline-none">
                <option value="">Kime Meydan Okuyorsun?</option>
                {allPlayers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={challengeType} onChange={(e) => setChallengeType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none">
                  <option>Kum Antrenmanı</option>
                  <option>Başka Takımla Antrenman</option>
                  <option>Disk Atma (Throwing)</option>
                  <option>Kondisyon (Gym/Yüzme/Koşu vs.)</option>
                  <option>Aktif Dinlenme (Esnetme/Recovery)</option>
                </select>
                <input type="number" placeholder={challengeType.includes("Antrenman") ? "Katılım Adedi" : "Süre (Dakika)"} value={challengeAmount} onChange={(e) => setChallengeAmount(e.target.value)} required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold p-3 rounded-xl text-xs md:text-sm transition-all">Meydan Okumayı Ateşle (48 Saat Süre! 🔥)</button>
              <p className="text-[10px] text-slate-500 text-center">Başarana: Normal Puan + 2 Bonus | Başaramayana: -3 Puan Ceza</p>
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
                      <p className="text-red-400 mt-0.5 font-semibold">GÖREV: {c.amount} {c.workout_type.includes("Antrenman") ? "Kez" : "Dk"} {c.workout_type}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mt-1 font-bold ${c.status === "Beklemede" ? "bg-amber-950 text-amber-400" : c.status === "Tamamlandı" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>{c.status === "Beklemede" ? "Savaş Devam Ediyor" : c.status}</span>
                    </div>
                    {isReceived && (
                      <button onClick={() => completeChallenge(c)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-2 rounded-xl shrink-0 transition-all">Yaptım 🥇</button>
                    )}
                  </div>
                );
              })}
              {challenges.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Şu an aktif düello yok.</p>}
            </div>
          </div>
        </div>

        {/* ANA RESPONSIVE GRID SISTEMI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SÜTUN 1: PROFİL VE ANTRENMAN İŞLEME (Mobilde sadece 'home' sekmesinde açık) */}
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
                <button onClick={addWorkout} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold p-2.5 rounded-xl text-xs transition-all">Antrenman İşle</button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Senin Kayıtların</h3>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 text-xs">
                {workouts.map((w) => (
                  <div key={w.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{w.type}</p>
                      <p className="text-[10px] text-slate-500">{w.type.includes("Antrenman") || w.type.includes("Challenge") ? `${w.amount} Kez` : `${w.amount} Dk`}</p>
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

          {/* SÜTUN 2: BU HAFTANIN YARIŞI VE ROZET VİTRİNİ (Mobilde sadece 'stats' sekmesinde açık) */}
          <div className={`lg:col-span-4 ${activeTab === "stats" ? "block" : "hidden lg:block"}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl sticky top-8">
              <div className="text-center mb-5 pb-3 border-b border-slate-800">
                <span className="text-2xl block mb-0.5">⚡</span>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">BU HAFTANIN YARIŞI</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Her Pazartesi otomatik sıfırlanır</p>
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
                    {player.badges && player.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-slate-800/40">
                        {player.badges.map((b: string, bIdx: number) => (
                          <span key={bIdx} className="bg-slate-900 text-slate-300 border border-slate-800 text-[9px] px-1.5 py-0.5 rounded-md font-medium" title={b}>
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SÜTUN 3: CANLI TAKIM AKTİVİTE DUVARI (Mobilde sadece 'stats' sekmesinde açık) */}
          <div className={`lg:col-span-4 ${activeTab === "stats" ? "block" : "hidden lg:block"}`}>
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
                      <span className={`font-black shrink-0 px-1.5 py-0.5 rounded text-[10px] ${act.points >= 0 ? "text-emerald-400 bg-emerald-950/50" : "text-red-400 bg-red-950/50"}`}>
                        {act.points >= 0 ? `+${act.points}` : act.points} P
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] italic">
                      {act.type.includes("🏆") || act.type.includes("❌") ? "" : `🏃‍♂️ ${act.amount} ${act.type.includes("Antrenman") ? "Kez" : "Dk"} `}
                      {act.type}
                    </p>
                  </div>
                ))}
                {activityFeed.length === 0 && <p className="text-slate-600 text-center py-10">Henüz hiçbir aktivite yok.</p>}
              </div>
            </div>
          </div>

          

        </div>

      </div>

      {/* 📱 SABİT MOBİL ALT MENÜ (NAVIGATION BAR) - Sadece küçük ekranlarda görünür */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 px-6 py-2 flex justify-around items-center z-50 shadow-2xl">
        <button onClick={() => setActiveTab("home")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "home" ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
          <span className="text-xl">🏠</span>
          <span className="text-[10px]">Ana Sayfa</span>
        </button>
        
        <button onClick={() => setActiveTab("challenges")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "challenges" ? "text-red-400 font-bold" : "text-slate-400"}`}>
          <span className="text-xl">⚔️</span>
          <span className="text-[10px]">Düellolar</span>
        </button>
        
        <button onClick={() => setActiveTab("stats")} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${activeTab === "stats" ? "text-cyan-400 font-bold" : "text-slate-400"}`}>
          <span className="text-xl">📈</span>
          <span className="text-[10px]">Sıralama</span>
        </button>
      </div>
    </main>
  );
}