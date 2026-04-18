import React, { useState } from "react";
import { sb } from "../../api/supabaseClient";

function Login({ onSwitchToRegister, onLoginSuccess }) {
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const virtualEmail = `${nama.trim().toLowerCase().replace(/\s/g, "")}@portofolio.com`;

    try {
      // --- PERBAIKAN: Menggunakan 'email' bukan 'nama' ---
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: virtualEmail, // <-- PERUBAHAN: Gunakan virtualEmail yang sudah dibuat
        password: password,
      });

      if (authError) throw new Error("Nama atau Password salah!");

      // Ambil data user dari tabel 'USER'
      const { data: userData, error: dbError } = await sb
        .from("USER")
        .select("*")
        .eq("id_user", authData.user.id)
        .single();

      if (dbError) throw dbError;

      onLoginSuccess(userData);
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="card">
        <h3>🔑 Login Portofolio</h3>
        
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <input 
              type="text" 
              placeholder="Nama Lengkap" 
              value={nama} 
              onChange={(e) => setNama(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group" style={{ position: 'relative' }}>
            {/*input*/}
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            {/*lihat psw */}
            <span 
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "MENGECEK..." : "MASUK"}
          </button>
        </form>

        <p className="form-footer">
          Belum punya akun? <b onClick={onSwitchToRegister} style={{ cursor: 'pointer', color: '#007BFF' }}>Daftar</b>
        </p>
      </div>
    </div>
  );
}

export default Login;