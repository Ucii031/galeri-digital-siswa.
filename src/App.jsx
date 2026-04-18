import React, { useState, useEffect } from "react";
import "./App.css";
import { sb } from "./api/supabaseClient"; 
import Home from "./pages/home/Home.jsx";
import Login from "./pages/login/Login.jsx";
import Register from "./pages/register/Register.jsx";
import UserDashboard from "./pages/userdasboard/UserDashboard.jsx";
import AdminDashboard from "./pages/admindasboard/AdminDashboard.jsx"; 

function App() {
  const [view, setView] = useState("home");
  const [userLogged, setUserLogged] = useState(null);
  const [loading, setLoading] = useState(true);

  //login rol
  const navigateByRole = (userData) => {
    if (userData.role === "admin") {
      setView("admin-dashboard");
    } else {
      setView("user-dashboard");
    }
  };
//cek sesi user
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          const { data, error } = await sb
            .from("USER")
            .select("*")
            .eq("id_user", user.id)
            .single();
          
          if (data) {
            setUserLogged(data);
            navigateByRole(data); 
          }
        }
      } catch (err) {
        console.error("Gagal memuat sesi:", err);
      } finally {
        setLoading(false); 
      }
    };
    checkUser();
  }, []);
  
  const handleStart = () => {
    if (userLogged) {
      navigateByRole(userLogged);
    } else {
      setView("login");
    }
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    setUserLogged(null);
    setView("home");
  };

  return (
    <>
      {(view === "home" || view === "login" || view === "register") && (
        <div className="app-container">
          <div className="gambar-bg-global">
            <img src="/Awan.png" alt="awan" className="img-awan" />
            <img src="/Taman.jpeg" alt="taman" className="img-taman" />
            <img src="/Anak.png" alt="anak" className="img-anak" />
            <img src="/Mobil.png" alt="mobil" className="img-mobil" />
            <img src="/logo.png" alt="logo" className="img-logo" />
          </div>

          <main className="main-content">
            {view === "home" && <Home onStart={handleStart} />}
            {view === "login" && (
              <Login 
                onSwitchToRegister={() => setView("register")} 
                onLoginSuccess={(userData) => {
                  setUserLogged(userData);
                  navigateByRole(userData);
                }} 
              />
            )}
            {view === "register" && (
              <Register onSwitchToLogin={() => setView("login")} />
            )}
          </main>
        </div>
      )}
      
      {view === "user-dashboard" && (
        <UserDashboard user={userLogged} onLogout={handleLogout} />
      )}

      {view === "admin-dashboard" && (
        <AdminDashboard user={userLogged} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;