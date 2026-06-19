"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase"; 

type Workout = {
  id?: number;
  type: string;
  amount: number;
  points: number;
  user_id: string;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("Koşu");
  const [amount, setAmount] = useState("");
  const [leaderboard, setLeaderboard] = useState<{ email: string; points: number }[]>([]);

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
      fetchWorkouts();
      fetchLeaderboard();
    } else {
      setWorkouts([]);
      setLeaderboard([]);
    }
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) console.error(error.message);
    else if (data) setWorkouts(data);
  };

  const fetchLeaderboard = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("workouts").select("points, user_id");
    if (error) {
      console.error(error.message);
      return;
    }

    if (data) {
      const userPointsMap: { [key: string]: number } = {};
      data.forEach((w) => {
        userPointsMap[w.user_id] = (userPointsMap[w.user_id] || 0) + w.points;
      });

      const sortedLeaderboard = Object.keys(userPointsMap).map((uid) => ({
        email: uid === user.id ? user.email : `Oyuncu (${uid.substring(0, 4)})`, 
        points: userPointsMap[uid],
      })).sort((a, b) => b.points - a.points);

      setLeaderboard(sortedLeaderboard);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert("Kayıt hatası: " + error.message);
    else alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Giriş hatası: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const calculatePoints = (type: string, amount: number) => {
    switch (type) {
      case "Koşu": return amount * 3;
      case "Forehand": return Math.floor(amount / 100) * 5;
      case "Backhand": return Math.floor(amount / 100) * 5;
      case "Gym": return amount * 10;
      default: return 0;
    }
  };

  const addWorkout = async () => {
    if (!user) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    const points = calculatePoints(type, numericAmount);

    const { data, error } = await supabase
      .from("workouts")
      .insert([{ type, amount: numericAmount, points, user_id: user.id }]) 
      .select();

    if (error) {
      alert("Hata: " + error.message);
    } else if (data) {
      setWorkouts([data[0], ...workouts]);
      setAmount("");
      fetchLeaderboard();
    }
  };

  const deleteWorkout = async (id: number) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) alert("Silme işlemi başarısız: " + error.message);
    else {
      setWorkouts(workouts.filter((w) => w.id !== id));
      fetchLeaderboard();
    }
  };

  const totalPoints = workouts.reduce((sum, w) => sum + w.points, 0);

  // 1. GİRİŞ YAPILMAMIŞSA: MODERN GİRİŞ KARTI
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
          
          <div className="text-center mb-8">
            <span className="text-4xl inline-block animate-bounce mb-2">🥏</span>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Ultimate Frisbee Team
            </h1>
            <p className="text-sm text-slate-400 mt-1">Antrenman Takip ve Skor Paneli</p>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">E-POSTA ADRESİ</label>
              <input 
                type="email" placeholder="isim@takim.com" value={email} onChange={(e) => setEmail(e.target.value)} required 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">ŞİFRE</label>
              <input 
                type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-slate-950 font-bold p-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 mt-2">
              {isRegistering ? "Kayıt Ol ve Katıl" : "Sisteme Giriş Yap"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {isRegistering ? "Zaten ekibin bir parçası mısın?" : "Henüz hesabın yok mu?"}{" "}
            <span onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 font-medium hover:underline cursor-pointer ml-1">
              {isRegistering ? "Giriş Yap" : "Kayıt Ol"}
            </span>
          </p>
        </div>
      </main>
    );
  }

  // 2. GİRİŞ YAPILMIŞSA: DEEP SPACE MULTI-COLUMN PANEL
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ÜST BAR / HEADER */}
        <header className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥏</span>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-wide">FRİZBİ HUB</h1>
              <p className="text-xs text-slate-400">Hoş geldin, <span className="text-emerald-400 font-semibold">{user.email}</span></p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-300 font-medium px-4 py-2 rounded-xl text-sm border border-slate-700/50 hover:border-red-900/50 transition-all">
            Güvenli Çıkış
          </button>
        </header>

        {/* ANA İÇERİK GRID YAPISI (BİLGİSAYARDA YAN YANA, TELEFONDA ALT ALTA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SOL TARAF: VERİ GİRİŞİ VE GEÇMİŞ (7 SÜTUN) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* SKOR KARTI VE YENİ EKLEME BÖLÜMÜ */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-5 -mt-5"></div>
              
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">KİŞİSEL PERFORMANS</p>
                <h2 className="text-4xl font-black text-white mt-1">
                  {totalPoints} <span className="text-lg font-bold text-cyan-400">Toplam Puan</span>
                </h2>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-slate-300">YENİ ANTRENMAN İŞLE</h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <select 
                    value={type} onChange={(e) => setType(e.target.value)} 
                    className="sm:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option>Koşu</option>
                    <option>Forehand</option>
                    <option>Backhand</option>
                    <option>Gym</option>
                  </select>

                  <input
                    type="number" placeholder={type === "Koşu" ? "KM" : type === "Gym" ? "Dakika" : "Atış Sayısı"} value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="sm:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />

                  <button onClick={addWorkout} className="sm:col-span-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold p-3 rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-95 text-sm">
                    Kaydet
                  </button>
                </div>
              </div>
            </div>

            {/* ANTRENMAN GEÇMİŞİ */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Son Faaliyetlerin</h3>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {workouts.map((workout) => (
                  <div key={workout.id} className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl flex justify-between items-center group hover:border-slate-700 transition-colors">
                    <div>
                      <span className="font-bold text-white text-sm sm:text-base">{workout.type}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">Miktar: {workout.amount}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-extrabold text-cyan-400 bg-cyan-950/40 border border-cyan-900/30 px-2.5 py-1 rounded-lg">
                        +{workout.points} P
                      </span>
                      <button 
                        onClick={() => workout.id && deleteWorkout(workout.id)} 
                        className="text-slate-600 hover:text-red-400 text-xs p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {workouts.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">Henüz hiç antrenman kaydı girmedin.</p>
                )}
              </div>
            </div>

          </div>

          {/* SAĞ TARAF:🏆 LİDERLİK TABLOSU / LEADERBOARD (5 SÜTUN) */}
          <div className="lg:col-span-5">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl sticky top-8">
              
              <div className="text-center mb-6 pb-4 border-b border-slate-800">
                <span className="text-4xl block mb-1">🏆</span>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">TAKIM LİDERLİK TABLOSU</h3>
                <p className="text-xs text-slate-500 mt-1">Zirve yarışı anlık güncellenir</p>
              </div>

              <div className="space-y-2">
                {leaderboard.map((player, index) => {
                  const isMe = player.email === user.email;
                  // İlk 3 oyuncu için madalya renkleri
                  const rankBg = index === 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                                 index === 1 ? "bg-slate-300/10 border-slate-300/30 text-slate-300" :
                                 index === 2 ? "bg-amber-700/10 border-amber-700/30 text-amber-600" : 
                                 "bg-slate-900 border-slate-800 text-slate-400";

                  return (
                    <div 
                      key={index} 
                      className={`flex justify-between items-center p-3.5 rounded-xl border transition-all ${
                        isMe ? "bg-gradient-to-r from-emerald-950/40 to-slate-900/80 border-emerald-500/40 shadow-md shadow-emerald-950/20" : "bg-slate-950/40 border-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 text-xs font-bold rounded-lg border flex items-center justify-center shrink-0 ${rankBg}`}>
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                        </span>
                        <span className={`text-sm truncate ${isMe ? "text-emerald-400 font-bold" : "text-slate-300 font-medium"}`}>
                          {player.email} {isMe && <span className="text-[10px] uppercase font-black bg-emerald-500 text-slate-950 px-1 rounded ml-1">Sen</span>}
                        </span>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${isMe ? "text-emerald-400" : "text-white"}`}>
                        {player.points} <span className="text-[10px] font-normal text-slate-500">Puan</span>
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
        
      </div>
    </main>
  );
}