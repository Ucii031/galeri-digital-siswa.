import React, { useState } from "react";
import { sb } from "../../api/supabaseClient";

function Register({ onSwitchToLogin }) {
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Generate email virtual berdasarkan nama
    const virtualEmail = `${nama.trim().toLowerCase().replace(/\s/g, "")}@portofolio.com`;

    try {
      // mengecek apakah nama sudah terdaftar
      const { data: userExist, error: checkError } = await sb
        .from("USER")
        .select("nama_lengkap") 
        .eq("nama_lengkap", nama.trim())
        .maybeSingle();

      if (userExist) {
        alert("❌ Nama ini sudah terdaftar! Silakan gunakan nama lain.");
        setLoading(false);
        return;
      }

      // 1. Daftar ke Supabase Auth dengan email virtual
      const { data: authData, error: authError } = await sb.auth.signUp({
        email: virtualEmail,
        password: password,
      });

      if (authError) throw authError;

      // simpan data k table USER
      if (authData.user) {
        const { error: dbError } = await sb.from("USER").insert([
          {
            id_user: authData.user.id,
            username: virtualEmail,
            nama_lengkap: nama.trim(),
            role: "siswa", 
            password: password, 
          },
        ]);

        if (dbError) throw dbError;

        alert("✅ Berhasil! Silakan Login.");
        onSwitchToLogin();
      }
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="card">
        <h3>📝 Daftar Baru</h3>
        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input
              type="text"
              placeholder="Masukkan Nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <span 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  zIndex: 2
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </span>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "MEMPROSES..." : "DAFTAR"}
          </button>
        </form>
        <p className="form-footer">
          Sudah punya akun? <b onClick={onSwitchToLogin} style={{cursor: "pointer", color: "#007BFF"}}>Login</b>
        </p>
      </div>
    </div>
  );
}

export default Register;