import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserDashboard.css';
import UserProfile from "../profile/UserProfile";
import { fetchComments, postComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout } from "react-icons/md";

const UserDashboard = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('beranda');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [karyaList, setKaryaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. STATE DATA USER LOKAL (Agar update foto/nama langsung sinkron)
  const [currentUserData, setCurrentUserData] = useState(user);

  const [selectedKarya, setSelectedKarya] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewingFriend, setViewingFriend] = useState(null);

  const fetchKarya = useCallback(async () => {
    try {
      setLoading(true);
      // pangil kategori
      const { data, error } = await sb
        .from('KARYA')
        .select(`
          *, 
          USER!KARYA_id_user_fkey ( id_user, nama_lengkap, foto_url, username, bio ),
          KATEGORI ( nama_kategori )
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
    if (currentView === 'beranda') fetchKarya();
  }, [currentView, fetchKarya]);

  const handleUserUpdate = (updatedData) => {
    setCurrentUserData(prev => ({ ...prev, ...updatedData }));
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsMenuOpen(false); 
  };

  const handleViewFriendProfile = (friendData) => {
    setViewingFriend(friendData);
    navigateTo('friend-profile'); 
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
    const { error } = await postComment(selectedKarya.id_karya, currentUserData.id_user, newComment);
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
        id_user: currentUserData.id_user,
        jenis_interaksi: 'like'
      }]);
      if (error) throw error;
      toast.success("Karya disukai! ❤️");
    } catch (error) {
      toast.error("Gagal menyukai karya");
    }
  };

  if (currentView === 'friend-profile') return <UserProfile user={currentUserData} viewingUser={viewingFriend} onBack={() => navigateTo('beranda')} />;
  if (currentView === 'profile') return <UserProfile user={currentUserData} onBack={() => navigateTo('beranda')} onUpdate={handleUserUpdate} />;

  const filteredKarya = karyaList.filter(item =>
    item.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.USER?.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.KATEGORI?.nama_kategori?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-right" />
      
      <nav className="navbar">
        <div className="logo" onClick={() => navigateTo('beranda')}>
          <img className='logo1' src="icon.ico" alt="logo" />
          <span className="logo-text">GaleriDigital</span>
        </div>

        {isMenuOpen && <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}></div>}

        <ul className={`nav-linkss ${isMenuOpen ? 'active' : ''}`}>
          <li>
            <a href="#beranda" className={currentView === 'beranda' ? 'active' : ''} 
               onClick={(e) => { e.preventDefault(); navigateTo('beranda'); }}>Beranda</a>
          </li>
          <li><a href="#galeri-fullscreen" onClick={() => setIsMenuOpen(false)}>Lihat Galeri</a></li>
          <li>
            <a href="#profile" onClick={(e) => { e.preventDefault(); navigateTo('profile'); }}>Profil Saya</a>
          </li>
          <li>
            <button className="btn-logout" onClick={onLogout}>
              <MdLogout size={18} /> Keluar
            </button>
          </li>
        </ul>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {currentView === 'beranda' && (
        <>
          <section className="hero">
            <div className="hero-content">
              <img className='logo-2' src="logo.png" alt="logo" />
              <span className="hero-badge">👋 Halo, {currentUserData?.nama_lengkap}</span>
              <h1 className="hero-title">Ruang Pameran <span className="highlight">Karya Siswa</span></h1>
              <p className="hero-subtitle">Jelajahi kreativitas tanpa batas dari teman-temanmu.</p>
              <div className="hero-buttons">
                <button className="btn btn-primary" onClick={() => navigateTo('profile')}>📤 Unggah Karya</button>
                <a href="#galeri-fullscreen" className="btn btn-secondary" onClick={() => setIsMenuOpen(false)}>🖼️ Lihat Galeri</a>
                <img className='awan' src="Awan.png" alt="awan" />
              </div>
            </div>
          </section>

          <section id="galeri-fullscreen" className="gallery-section-fullscreen">
            <div className="gallery-controls">
              <div className="search-box">
                <input type="search" placeholder="Cari karya atau kategori..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            {loading ? (
              <div className="loading-state-fullscreen">Menyiapkan galeri... ⏳</div>
            ) : (
              <div className="gallery-snap-container">
                {filteredKarya.map((art) => (
                  <div key={art.id_karya} className="gallery-post-item">
                    <div className="gallery-media-wrapper">
                      <img src={art.file_path} alt={art.judul} className="gallery-media-img" />
                      
                      {/* TAMPILAN LABEL KATEGORI DI ATAS FOTO */}
                      {art.KATEGORI?.nama_kategori && (
                        <span className="category-tag-badge">
                          {art.KATEGORI.nama_kategori}
                        </span>
                      )}
                      
                      <div className="gallery-media-overlay"></div>
                    </div>
                    <div className="gallery-actions-side">
                      <button className="btn-action-like" onClick={() => handleLike(art.id_karya)}>❤️</button>
                      <button className="btn-action-comment" onClick={() => handleOpenComments(art)}>💬</button>
                    </div>
                    <div className="gallery-post-info">
                      <div className="author-container" onClick={() => handleViewFriendProfile(art.USER)}>
                        <img src={art.USER?.foto_url || "https://via.placeholder.com/40"} alt="avatar" className="author-avatar-small" />
                        <h4 className="art-author-name">@{art.USER?.nama_lengkap?.split(' ')[0].toLowerCase()}</h4>
                      </div>
                      <h3 className="art-post-title">{art.judul}</h3>
                      <p className="art-post-desc">{art.deskripsi || "Tanpa deskripsi."}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedKarya && (
        <div className="modal-overlay" onClick={() => setSelectedKarya(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Komentar</h3>
              <button className="close-modal" onClick={() => setSelectedKarya(null)}>✕</button>
            </div>
            <div className="comments-list">
              {loadingComments ? (
                <p className="loading-text">Memuat... ⏳</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id_interaksi} className="comment-item">
                    <img 
                      src={c.USER?.foto_url || "https://via.placeholder.com/40"} 
                      onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }}
                      className="comment-avatar"
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="comment-text-block">
                      <p className="comment-author-name" 
                         onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }}
                         style={{ cursor: 'pointer' }}>
                        {c.USER?.nama_lengkap}
                      </p>
                      <p className="comment-text">{c.isi_komentar}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="comment-form" onSubmit={handleSendComment}>
              <input type="text" placeholder="Tambahkan komentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button type="submit" className="btn-send">Kirim</button>
            </form>
          </div>
        </div>
      )}

      <footer className="footer">
        <p> GaleriDigital - SD Katolik 10 Santa Theresia Manado</p>
      </footer>
    </div>
  );
};

export default UserDashboard;