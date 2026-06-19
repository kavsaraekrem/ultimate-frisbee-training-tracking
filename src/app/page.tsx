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
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("Kum Antrenmanı");
  const [amount, setAmount] = useState("");
  const [currentLeaderboard, setCurrentLeaderboard] = useState<{ email: string; points: number }[]>([]);
  const [lastWeekPodium, setLastWeekPodium] = useState<{ email: string; points: number }[]>([]);

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
      fetchLeaderboards();
    } else {
      setWorkouts([]);
      setCurrentLeaderboard([]);
      setLastWeekPodium([]);
    }
  }, [user]);

  // Yardımcı Fonksiyon: Haftaların Başlangıç ve Bitiş Tarihlerini Bulma
  const getWeekRanges = () => {
    const now = new Date();
    
    // Bu haftanın Pazartesi gününü bul (00:00:00)
    const currentMonday = new Date(now);
    const day = currentMonday.getDay();
    const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1); // Pazartesiye eşitle
    currentMonday.setDate(diff);
    currentMonday.setHours(0, 0, 0, 0);

    // Geçen haftanın Pazartesi günü (00:00:00)
    const lastMonday = new Date(currentMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);

    // Geçen haftanın Pazar günü (23:59:59)
    const lastSunday = new Date(currentMonday);
    lastSunday.setMilliseconds(-1); // Bu haftanın pazartesisinden 1 milisaniye öncesi = Geçen pazar gecesi

    return { currentMonday, lastMonday, lastSunday };
  };

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

  const fetchLeaderboards = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("workouts").select("points, user_id, created_at");
    if (error) {
      console.error(error.message);
      return;
    }

    if (data) {
      const { currentMonday, lastMonday, lastSunday } = getWeekRanges();

      const currentWeekMap: { [key: string]: number } = {};
      const lastWeekMap: { [key: string]: number } = {};

      data.forEach((w) => {
        const workoutDate = new Date(w.created_at || "");

        // Bu haftanın liderlik tablosu hesaplaması
        if (workoutDate >= currentMonday) {
          currentWeekMap[w.user_id] = (currentWeekMap[w.user_id] || 0) + w.points;
        }
        // Geçen haftanın liderlik tablosu hesaplaması (Kürsü için)
        if (workoutDate >= lastMonday && workoutDate <= lastSunday) {
          lastWeekMap[w.user_id] = (lastWeekMap[w.user_id] || 0) + w.points;
        }
      });

      // Bu Haftanın Sıralaması
      const sortedCurrent = Object.keys(currentWeekMap).map((uid) => ({
        email: uid === user.id ? user.email : `Oyuncu (${uid.substring(0, 4)})`, 
        points: Number(currentWeekMap[uid].toFixed(1)),
      })).sort((a, b) => b.points - a.points);

      // Geçen Haftanın İlk 3'ü (Kürsü)
      const sortedLastWeek = Object.keys(lastWeekMap).map((uid) => ({
        email: uid === user.id ? user.email : `Oyuncu (${uid.substring(0, 4)})`, 
        points: Number(lastWeekMap[uid].toFixed(1)),
      })).sort((a, b) => b.points - a.points).slice(0, 3); // Sadece ilk 3 kişiyi al

      setCurrentLeaderboard(sortedCurrent);
      setLastWeekPodium(sortedLastWeek);
    }
  };

  // 🎯 YENİ PUANLAMA MANTIĞI FORMÜLÜ
  const calculatePoints = (type: string, amount: number) => {
    switch (type) {
      case "Kum Antrenmanı": 
        return amount * 5; // Kaç adet antrenmana katıldıysa x 5 Puan
      case "Başka Takımla Antrenman": 
        return amount * 3; // Kaç adet antrenmana katıldıysa x 3 Puan
      case "Disk Atma (Throwing)": 
        return (amount / 30) * 2; // Her 30 dakika için 2 Puan
      case "Kondisyon (Gym/Yüzme/Koşu vs.)": 
        return (amount / 30) * 1.5; // Her 30 dakika için 1.5 Puan (1 Saat = 3 Puan)
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
      fetchLeaderboards();
    }
  };

  const deleteWorkout = async (id: number) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) alert("Silme işlemi başarısız: " + error.message);
    else {
      setWorkouts(workouts.filter((w) => w.id !== id));
      fetchLeaderboards();
    }
  };

  const totalPoints = workouts.reduce((sum, w) => sum + w.points, 0);

  // GİRİŞ EKRANI
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
          <div className="text-center mb-8">
            <span className="text-4xl inline-block animate-bounce mb-2">🥏</span>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Ultimate Frisbee Team</h1>
            <p className="text-sm text-slate-400 mt-1">Antrenman Takip ve Skor Paneli</p>
          </div>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <input type="email" placeholder="isim@takim.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500" />
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500" />
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold p-3 rounded-xl transition-all active:scale-95">{isRegistering ? "Kayıt Ol" : "Giriş Yap"}</button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">{isRegistering ? "Zaten üye misin?" : "Hesabın yok mu?"} <span onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 font-medium hover:underline cursor-pointer ml-1">{isRegistering ? "Giriş Yap" : "Kayıt Ol"}</span></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥏</span>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-wide">FRİZBİ HUB</h1>
              <p className="text-xs text-slate-400">Oyuncu: <span className="text-emerald-400 font-semibold">{user.email}</span></p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-300 font-medium px-4 py-2 rounded-xl text-sm border border-slate-700 transition-all">Çıkış Yap</button>
        </header>

        {/* 🔥 GEÇEN HAFTANIN EN İYİLERİ (PODYUM/KÜRSÜ) BÖLÜMÜ */}
        {lastWeekPodium.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-slate-800 rounded-2xl p-6 shadow-xl text-center">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">🏆 GEÇEN HAFTANIN EN İYİLERİ (KÜRSÜ)</h3>
            <div className="flex flex-wrap justify-center items-end gap-4 pt-2">
              {/* 2. Sıra */}
              {lastWeekPodium[1] && (
                <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl w-40 h-28 flex flex-col justify-center order-1 sm:order-1">
                  <span className="text-2xl">🥈</span>
                  <p className="text-xs text-slate-300 font-bold truncate mt-1">{lastWeekPodium[1].email}</p>
                  <p className="text-sm font-black text-slate-400">{lastWeekPodium[1].points} Puan</p>
                </div>
              )}
              {/* 1. Sıra (Zirve) */}
              {lastWeekPodium[0] && (
                <div className="bg-slate-900 border-2 border-amber-500 p-4 rounded-xl w-44 h-36 flex flex-col justify-center shadow-lg shadow-amber-500/5 order-unique sm:order-2">
                  <span className="text-3xl animate-bounce">🥇</span>
                  <p className="text-sm text-amber-400 font-black truncate mt-1">{lastWeekPodium[0].email}</p>
                  <p className="text-lg font-black text-white">{lastWeekPodium[0].points} Puan</p>
                </div>
              )}
              {/* 3. Sıra */}
              {lastWeekPodium[2] && (
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-40 h-24 flex flex-col justify-center order-2 sm:order-3">
                  <span className="text-xl">🥉</span>
                  <p className="text-xs text-slate-400 font-bold truncate mt-1">{lastWeekPodium[2].email}</p>
                  <p className="text-xs font-black text-amber-700">{lastWeekPodium[2].points} Puan</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANA İÇERİK GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SOL PANEL: VERİ GİRİŞİ & GEÇMİŞ */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* GİRİŞ PANELİ */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">TÜM ZAMANLAR KİŞİSEL SKORUN</p>
                <h2 className="text-3xl font-black text-white mt-1">{totalPoints.toFixed(1)} <span className="text-sm font-bold text-cyan-400">Toplam Puan</span></h2>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-slate-300">ANTRENMAN İŞLE</h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <select value={type} onChange={(e) => setType(e.target.value)} className="sm:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none">
                    <option>Kum Antrenmanı</option>
                    <option>Başka Takımla Antrenman</option>
                    <option>Disk Atma (Throwing)</option>
                    <option>Kondisyon (Gym/Yüzme/Koşu vs.)</option>
                  </select>

                  <input
                    type="number" 
                    placeholder={
                      type.includes("Antrenman") ? "Katılım Adedi (Örn: 1)" : "Süre (Dakika Olarak)"
                    } 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="sm:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none"
                  />

                  <button onClick={addWorkout} className="sm:col-span-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold p-3 rounded-xl transition-all text-sm">Kaydet</button>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  *Not: Antrenmanlar için adet, Disk ve Kondisyon için **dakika** giriniz (Örn: 1 saat için 60 yazın).
                </p>
              </div>
            </div>

            {/* GEÇMİŞ */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Senin Tüm Kayıtların</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {workouts.map((w) => (
                  <div key={w.id} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex justify-between items-center group">
                    <div>
                      <span className="font-bold text-white text-sm">{w.type}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">{w.type.includes("Antrenman") ? `Katılım: ${w.amount} Kez` : `Süre: ${w.amount} Dakika`}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-extrabold text-cyan-400 bg-cyan-950/40 border border-cyan-900/30 px-2.5 py-1 rounded-lg">+{w.points.toFixed(1)} P</span>
                      <button onClick={() => w.id && deleteWorkout(w.id)} className="text-slate-600 hover:text-red-400 text-xs">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* SAĞ PANEL: CANLI LİDERLİK TABLOSU (HAFTALIK) */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-8">
              <div className="text-center mb-6 pb-4 border-b border-slate-800">
                <span className="text-3xl block mb-1">⚡</span>
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">BU HAFTANIN YARIŞI</h3>
                <p className="text-xs text-slate-500 mt-1">Her Pazartesi otomatik sıfırlanır</p>
              </div>

              <div className="space-y-2">
                {currentLeaderboard.map((player, index) => {
                  const isMe = player.email === user.email;
                  return (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-xl border ${isMe ? "bg-emerald-950/20 border-emerald-500/40" : "bg-slate-950/40 border-slate-800/60"}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 text-xs font-bold bg-slate-800 rounded flex items-center justify-center text-slate-400 shrink-0">{index + 1}</span>
                        <span className={`text-sm truncate ${isMe ? "text-emerald-400 font-bold" : "text-slate-300"}`}>{player.email}</span>
                      </div>
                      <span className="text-sm font-black text-white">{player.points} <span className="text-[10px] font-normal text-slate-500">P</span></span>
                    </div>
                  );
                })}
                {currentLeaderboard.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Bu hafta henüz kimse antrenman girmedi. İlk sen ol!</p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}