import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserDashboard.css';
import UserProfile from "../profile/UserProfile";
import { fetchComments, postComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout} from "react-icons/md";

const UserDashboard = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('beranda');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [karyaList, setKaryaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedKarya, setSelectedKarya] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewingFriend, setViewingFriend] = useState(null);

  const fetchKarya = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await sb
        .from('KARYA')
        .select(`
          *, 
          USER!KARYA_id_user_fkey ( id_user, nama_lengkap, foto_url, username, bio )
        `)
        .eq('status', 'publik')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKaryaList(data || []);
    } catch (error) {
      console.error('Error fetching karya:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentView === 'beranda') {
      fetchKarya();
    }
  }, [currentView, fetchKarya]);

  const handleViewFriendProfile = (friendData) => {
    setViewingFriend(friendData);
    setCurrentView('friend-profile');
  };

  const handleOpenComments = async (karya) => {
    setSelectedKarya(karya);
    setLoadingComments(true);
    const { data, error } = await fetchComments(karya.id_karya);
    if (!error) setComments(data || []);
    setLoadingComments(false);
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { error } = await postComment(selectedKarya.id_karya, user.id_user, newComment);
    if (error) {
      toast.error("Gagal mengirim komentar");
    } else {
      toast.success("Komentar terkirim! 💬");
      setNewComment("");
      const { data } = await fetchComments(selectedKarya.id_karya);
      setComments(data || []);
    }
  };

  const handleLike = async (idKarya) => {
    try {
      const { error } = await sb.from('INTERAKSI').insert([{
          id_karya: idKarya,
          id_user: user.id_user,
          jenis_interaksi: 'like'
        }]);
      if (error) throw error;
      toast.success("Karya disukai! ❤️");
    } catch (error) {
      toast.error("Gagal menyukai karya");
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  if (currentView === 'friend-profile') {
    return <UserProfile user={user} viewingUser={viewingFriend} onBack={() => setCurrentView('beranda')} />;
  }

  if (currentView === 'profile') {
    return <UserProfile user={user} onBack={() => setCurrentView('beranda')} />;
  }

  const filteredKarya = karyaList.filter(item =>
    item.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.USER?.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-right" />
      <nav className="navbar">
        <div className="logo" onClick={() => navigateTo('beranda')} style={{ cursor: 'pointer' }}>
          <img className='logo1' src="icon.ico" alt="logo" />
          <span className="logo-text">GaleriDigital</span>
        </div>
        <ul className={`nav-linkss ${isMenuOpen ? 'active' : ''}`}>
          <li><a href="#beranda" className={currentView === 'beranda' ? 'active' : ''} onClick={(e) => { e.preventDefault(); navigateTo('beranda'); }}>Beranda</a></li>
          <li><a href="#galeri-fullscreen">Lihat Galeri</a></li>
          <li><a href="#profile" onClick={(e) => { e.preventDefault(); navigateTo('profile'); }}>Profil Saya</a></li>
          <li>
          <button className="btn-logout" onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdLogout size={18} /> Keluar
          </button>
          </li>
        </ul>
        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? '✕' : '☰'}</button>
      </nav>

      {currentView === 'beranda' && (
        <>
          <section className="hero">
            <div className="hero-content">
              <img className='logo-2' src="logo.png" alt="logo" />
              <span className="hero-badge">👋 Halo, {user?.nama_lengkap}</span>
              <h1 className="hero-title">Ruang Pameran <span className="highlight">Karya Siswa</span></h1>
              <p className="hero-subtitle">Jelajahi kreativitas tanpa batas dari seluruh teman sekolahmu.</p>
              <div className="hero-buttons">
                <button className="btn btn-primary" onClick={() => navigateTo('profile')}>📤 Unggah Karya</button>
                <a href="#galeri-fullscreen" className="btn btn-secondary">🖼️ Lihat Galeri</a>
                <img className='awan' src="Awan.png" alt="awan" />
              </div>
            </div>
          </section>

          <section id="galeri-fullscreen" className="gallery-section-fullscreen">
            <div className="gallery-controls">
              <div className="search-box">
                <input type="search" placeholder="Cari karya atau kreator..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            {loading ? (
              <div className="loading-state-fullscreen">Menyiapkan galeri... ⏳</div>
            ) : (
              <div className="gallery-snap-container">
                {filteredKarya.map((art) => (
                  <div key={art.id_karya} className="gallery-post-item">
                    <div className="gallery-media-wrapper">
                      <img src={art.file_path || "https://via.placeholder.com/1000x1500?text=Karya+Siswa"} alt={art.judul} className="gallery-media-img" />
                      <div className="gallery-media-overlay"></div>
                    </div>
                    <div className="gallery-actions-side">
                      <div className="action-item-group">
                        <button className="btn-action-like" onClick={() => handleLike(art.id_karya)}>❤️</button>
                      </div>
                      <div className="action-item-group">
                        <button className="btn-action-comment" onClick={() => handleOpenComments(art)}>💬</button>
                      </div>
                    </div>
                    <div className="gallery-post-info">
                      <div className="author-container" onClick={() => handleViewFriendProfile(art.USER)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={art.USER?.foto_url || "https://via.placeholder.com/40"} 
                          alt="avatar" 
                          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <h4 className="art-author-name">
                          @{art.USER?.nama_lengkap?.split(' ')[0].toLowerCase() || "siswa"}
                        </h4>
                      </div>
                      <h3 className="art-post-title">{art.judul}</h3>
                      {art.deskripsi && <p className="art-post-desc">{art.deskripsi}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

  {/* ============================== MODAL KOMENTAR (Tampilan ala TikTok) ============================== */}
{selectedKarya && (
  <div className="modal-overlay" onClick={() => setSelectedKarya(null)}>
    {/* Menghentikan propagasi klik agar modal tidak tertutup saat konten di klik */}
    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderRadius: '15px', overflow: 'hidden' }}>
      
      {/* HEADER MODAL */}
      <div className="modal-header" style={{ borderBottom: '1px solid #eee', padding: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Komentar</h3>
        <button className="close-modal" onClick={() => setSelectedKarya(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
      </div>
      
      {/* DAFTAR KOMENTAR (Area Scroll) */}
      <div className="comments-list" style={{ maxHeight: '400px', overflowY: 'auto', padding: '15px', backgroundColor: '#fff' }}>
        {loadingComments ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Memuat komentar... ⏳</p>
        ) : comments.length > 0 ? (
          comments.map((c) => (
            <div key={c.id_interaksi} className="comment-item" style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start' }}>
              
              {/* --- 1. FOTO PROFIL (BISA DIKLIK) --- */}
              <img 
                // Pastikan c.USER.foto_url terambil dari API (seperti pembahasan sebelumnya)
                src={c.USER?.foto_url || "https://via.placeholder.com/40"} 
                alt={`Foto ${c.USER?.nama_lengkap || 'User'}`} 
                onClick={() => {
                  handleViewFriendProfile(c.USER); // Jalankan fungsi navigasi profil teman
                  setSelectedKarya(null);         // Tutup modal komentar
                }}
                style={{ 
                  width: '36px',          // Ukuran foto sedikit lebih besar agar jelas
                  height: '36px', 
                  borderRadius: '50%',   // Bentuk lingkaran
                  cursor: 'pointer',      // Indikator bisa diklik (kursor tangan)
                  objectFit: 'cover',     // Foto tidak gepeng
                  flexShrink: 0,          // Foto tidak mengecil jika teks panjang
                  border: '1px solid #311d1d38' // Bingkai tipis opsional
                }} 
              />

              {/* AREA TEKS KOMENTAR */}
              <div className="comment-text-block" style={{ flex: 1 }}>
                {/* --- 2. NAMA USER (BISA DIKLIK) --- */}
                <p 
                  onClick={() => {
                    handleViewFriendProfile(c.USER); // Sama seperti foto, klik nama juga navigasi
                    setSelectedKarya(null);
                  }}
                  style={{ 
                    fontWeight: '600',    // Sedikit lebih tebal ala TikTok
                    margin: '0 0 2px 0',  // Jarak tipis ke isi komentar
                    fontSize: '0.9rem', 
                    cursor: 'pointer',      // Indikator bisa diklik
                    color: '#000',
                    display: 'inline-block' // Agar area klik hanya sebatas teks nama
                  }}
                >
                  {c.USER?.nama_lengkap || "Siswa"}
                </p>
                
                {/* ISI KOMENTAR */}
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#333', lineHeight: '1.4' }}>
                  {c.isi_komentar}
                </p>
                
                {/* (Opsional) WAKTU KOMENTAR - Jika data ada di API */}
                {/* <span style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px', display: 'block' }}>1j yang lalu</span> */}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#888' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 10px 0' }}>💬</p>
            <p style={{ margin: 0 }}>Belum ada komentar.</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem' }}>Jadilah yang pertama berkomentar!</p>
          </div>
        )}
      </div>

      {/* FORM INPUT KOMENTAR (Tetap di Bawah) */}
      <form className="comment-form" onSubmit={handleSendComment} style={{ borderTop: '1px solid #eee', padding: '10px 15px', display: 'flex', gap: '10px', backgroundColor: '#fff' }}>
        <input
          type="text"
          placeholder="Tambahkan komentar..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          autoFocus
          style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none', fontSize: '0.9rem' }}
        />
        <button type="submit" className="btn-send" style={{ padding: '0 15px', backgroundColor: 'transparent', color: '#fe2c55', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
          Kirim
        </button>
      </form>
    </div>
  </div>
)}
      
      <footer className="footer">
        <p>© 2026 GaleriDigital - SD Katolik 10 Santa Theresia Manado</p>
      </footer>
    </div>
  );
};

export default UserDashboard;