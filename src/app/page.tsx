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

  // 1. Oturum Durumunu Takip Et
  useEffect(() => {
    // Mevcut aktif kullanıcıyı al
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Kullanıcı giriş/çıkış yaptığında tetiklenir
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Kullanıcı Giriş Yaptıysa Verilerini ve Liderlik Tablosunu Çek
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
      .eq("user_id", user.id) // Sadece giriş yapan kullanıcının verilerini getir
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Veriler çekilirken hata oluştu:", error.message);
    } else if (data) {
      setWorkouts(data);
    }
  };

  const fetchLeaderboard = async () => {
    if (!user) return;

    // Tüm antrenmanları çekiyoruz (Kimin ne puan aldığını görmek için)
    const { data, error } = await supabase
      .from("workouts")
      .select("points, user_id");

    if (error) {
      console.error("Liderlik tablosu çekilemedi:", error.message);
      return;
    }

    if (data) {
      const userPointsMap: { [key: string]: number } = {};
      data.forEach((w) => {
        userPointsMap[w.user_id] = (userPointsMap[w.user_id] || 0) + w.points;
      });

      // Objeyi listeye çevirip puana göre büyükten küçüğe sıralıyoruz
      const sortedLeaderboard = Object.keys(userPointsMap).map((uid) => ({
        email: uid === user.id ? user.email : `Oyuncu (${uid.substring(0, 4)})`, 
        points: userPointsMap[uid],
      })).sort((a, b) => b.points - a.points);

      setLeaderboard(sortedLeaderboard);
    }
  };

  // 3. Hesap Oluşturma (Kayıt Olma)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert("Kayıt hatası: " + error.message);
    else alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
  };

  // 4. Giriş Yapma
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Giriş hatası: " + error.message);
  };

  // 5. Çıkış Yapma
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

  // 6. Antrenman Ekleme (user_id ile)
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
      alert("Veri kaydedilirken bir hata oluştu: " + error.message);
    } else if (data) {
      setWorkouts([data[0], ...workouts]);
      setAmount("");
      fetchLeaderboard(); // Tabloyu anlık güncelle
    }
  };

  const deleteWorkout = async (id: number) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) alert("Silme işlemi başarısız: " + error.message);
    else {
      setWorkouts(workouts.filter((w) => w.id !== id));
      fetchLeaderboard(); // Silindikten sonra liderlik tablosunu da güncelle
    }
  };

  const totalPoints = workouts.reduce((sum, w) => sum + w.points, 0);

  // GİRİŞ YAPILMAMIŞSA GÖSTERİLECEK EKRAN
  if (!user) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 400, margin: "auto" }}>
        <h1>🥏 Frizbi Takımı Giriş</h1>
        <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8 }} />
          <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: 8 }} />
          <button type="submit" style={{ padding: 10, background: "#0070f3", color: "white", border: "none", cursor: "pointer" }}>
            {isRegistering ? "Kayıt Ol" : "Giriş Yap"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 15 }}>
          {isRegistering ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
          <span onClick={() => setIsRegistering(!isRegistering)} style={{ color: "#0070f3", cursor: "pointer", textDecoration: "underline" }}>
            {isRegistering ? "Giriş Yap" : "Kayıt Ol"}
          </span>
        </p>
      </main>
    );
  }

  // GİRİŞ YAPILMIŞSA GÖSTERİLECEK ANA EKRAN
  return (
    <main style={{ padding: 20, fontFamily: "sans-serif", maxWidth: 600, margin: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>👋 Hoş geldin, <b>{user.email}</b></span>
        <button onClick={handleLogout} style={{ padding: "5px 10px", background: "#eee", border: "1px solid #ccc", cursor: "pointer" }}>Çıkış Yap</button>
      </div>

      <h1 style={{ marginTop: 20 }}>🥏 Frizbi Antrenman Takip Sistemi</h1>
      <h2>Kişisel Toplam Puanın: {totalPoints}</h2>

      <div style={{ marginTop: 20 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 5 }}>
          <option>Koşu</option>
          <option>Forehand</option>
          <option>Backhand</option>
          <option>Gym</option>
        </select>

        <input
          type="number"
          placeholder="Miktar"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginLeft: 10, marginRight: 10, padding: 5 }}
        />

        <button onClick={addWorkout} style={{ padding: "5px 15px" }}>Ekle</button>
      </div>

      <h2 style={{ marginTop: 30 }}>Antrenman Geçmişin</h2>
      <ul>
        {workouts.map((workout) => (
          <li key={workout.id} style={{ marginBottom: 10 }}>
            {workout.type} - {workout.amount} - {workout.points} puan
            <button onClick={() => workout.id && deleteWorkout(workout.id)} style={{ marginLeft: 15, color: "red", cursor: "pointer" }}>
              Sil
            </button>
          </li>
        ))}
        {workouts.length === 0 && <p>Henüz antrenman eklemedin.</p>}
      </ul>

      <h2 style={{ marginTop: 40 }}>🏆 Takım Liderlik Tablosu (Leaderboard)</h2>
      <div style={{ background: "#f9f9f9", padding: 15, borderRadius: 8, border: "1px solid #ddd" }}>
        {leaderboard.map((player, index) => (
          <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee", fontWeight: player.email === user.email ? "bold" : "normal" }}>
            <span>{index + 1}. {player.email} {player.email === user.email && "(Sen)"}</span>
            <span>{player.points} Puan</span>
          </div>
        ))}
      </div>
    </main>
  );
}