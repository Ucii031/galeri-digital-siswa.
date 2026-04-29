import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserDashboard.css';
import UserProfile from "../profile/UserProfile";
import { fetchComments, postComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout, MdHowToVote } from "react-icons/md";

const UserDashboard = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('beranda');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [karyaList, setKaryaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [currentUserData, setCurrentUserData] = useState(user);
  const [selectedKarya, setSelectedKarya] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewingFriend, setViewingFriend] = useState(null);

  // --- STATE POLLING ---
  const [allStudents, setAllStudents] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState({});
  const [pollingStats, setPollingStats] = useState({}); // State untuk menyimpan jumlah suara otomatis

  // --- LOGIKA FETCH DATA POLLING (Sama Seperti Admin) ---
  const fetchPollingContext = useCallback(async () => {
    try {
      const { data: students } = await sb.from('USER').select('id_user, nama_lengkap, foto_url').eq('role', 'siswa');
      
      // Ambil seluruh data dari tabel POLLING untuk menghitung statistik suara
      const { data: allVotes } = await sb.from('POLLING').select('kategori_polling');
      
      const { data: myVotes } = await sb.from('POLLING').select('kategori_polling, id_target_siswa').eq('id_pemilih', currentUserData.id_user);
      
      setAllStudents(students || []);
      setUserVotes(myVotes?.map(v => v.kategori_polling) || []);

      // Hitung total suara per kategori secara otomatis
      const stats = {};
      allVotes?.forEach(v => {
        stats[v.kategori_polling] = (stats[v.kategori_polling] || 0) + 1;
      });
      setPollingStats(stats);

      const previousVotes = {};
      myVotes?.forEach(v => {
        const student = students.find(s => s.id_user === v.id_target_siswa);
        if (student) previousVotes[v.kategori_polling] = student;
      });
      setSelectedCandidates(previousVotes);
    } catch (err) {
      console.error("Gagal memuat polling:", err);
    }
  }, [currentUserData.id_user]);

  const handleVote = async (studentId, kategori) => {
    const studentObj = allStudents.find(s => s.id_user === studentId);
    const { error } = await sb.from('POLLING').insert([{
      id_pemilih: currentUserData.id_user,
      id_target_siswa: studentId,
      kategori_polling: kategori
    }]);

    if (!error) {
      toast.success(`Berhasil memilih ${studentObj.nama_lengkap}!`);
      setUserVotes([...userVotes, kategori]);
      setSelectedCandidates(prev => ({ ...prev, [kategori]: studentObj }));
      
      // Update perhitungan suara secara otomatis di UI setelah klik
      setPollingStats(prev => ({
        ...prev,
        [kategori]: (prev[kategori] || 0) + 1
      }));
    } else {
      toast.error("Gagal mengirim suara");
    }
  };

  // --- LOGIKA NAVIGASI ---
  useEffect(() => {
    const handleBackButton = (event) => {
      if (selectedKarya) {
        setSelectedKarya(null);
        window.history.replaceState({ subView: 'beranda' }, ""); 
      } 
      else if (currentView === 'profile' || currentView === 'friend-profile' || currentView === 'polling') {
        setCurrentView('beranda');
      }
    };
    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [selectedKarya, currentView]);

  const navigateTo = (view) => {
    if (view !== currentView) {
      window.history.pushState({ subView: view }, ""); 
      setCurrentView(view);
      if(view === 'polling') fetchPollingContext();
    }
    setIsMenuOpen(false); 
  };

  const fetchKarya = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await sb
        .from('KARYA')
        .select(`
          *, 
          USER!KARYA_id_user_fkey ( id_user, nama_lengkap, foto_url, username, bio ),
          KATEGORI ( nama_kategori ),
          INTERAKSI ( id_user, jenis_interaksi )
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

  const handleViewFriendProfile = (friendData) => {
    setViewingFriend(friendData);
    navigateTo('friend-profile'); 
  };

  const handleOpenComments = async (karya) => {
    window.history.pushState({ modal: 'open' }, ""); 
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
    const karyaIndex = karyaList.findIndex(k => k.id_karya === idKarya);
    if (karyaIndex === -1) return;

    const targetKarya = karyaList[karyaIndex];
    const isLiked = targetKarya.INTERAKSI?.some(i => i.id_user === currentUserData.id_user && i.jenis_interaksi === 'like');

    const updatedKaryaList = [...karyaList];
    if (isLiked) {
      updatedKaryaList[karyaIndex].INTERAKSI = targetKarya.INTERAKSI.filter(i => i.id_user !== currentUserData.id_user);
    } else {
      const newLike = { id_user: currentUserData.id_user, jenis_interaksi: 'like' };
      updatedKaryaList[karyaIndex].INTERAKSI = [...(targetKarya.INTERAKSI || []), newLike];
    }
    setKaryaList(updatedKaryaList);

    try {
      if (isLiked) {
        await sb.from('INTERAKSI').delete().eq('id_karya', idKarya).eq('id_user', currentUserData.id_user).eq('jenis_interaksi', 'like');
      } else {
        await sb.from('INTERAKSI').insert([{ id_karya: idKarya, id_user: currentUserData.id_user, jenis_interaksi: 'like' }]);
      }
    } catch (error) {
      fetchKarya(); 
      toast.error("Gagal memproses like");
    }
  };

  if (currentView === 'friend-profile') {
    return <UserProfile user={currentUserData} viewingUser={viewingFriend} onBack={() => navigateTo('beranda')} />;
  }
  if (currentView === 'profile') {
    return <UserProfile user={currentUserData} onBack={() => navigateTo('beranda')} onUpdate={handleUserUpdate} />;
  }

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
          <li><a href="#beranda" className={currentView === 'beranda' ? 'active' : ''} onClick={(e) => { e.preventDefault(); navigateTo('beranda'); }}>Beranda</a></li>
          <li><a href="#polling" className={currentView === 'polling' ? 'active' : ''} onClick={(e) => { e.preventDefault(); navigateTo('polling'); }}>Polling</a></li>
          <li><a href="#galeri-fullscreen" onClick={() => setIsMenuOpen(false)}>Lihat Galeri</a></li>
          <li><a href="#profile" onClick={(e) => { e.preventDefault(); navigateTo('profile'); }}>Profil Saya</a></li>
          <li><button className="btn-logout" onClick={onLogout}><MdLogout size={18} /> Keluar</button></li>
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
                {filteredKarya.map((art) => {
                  const userHasLiked = art.INTERAKSI?.some(i => i.id_user === currentUserData.id_user && i.jenis_interaksi === 'like');
                  return (
                    <div key={art.id_karya} className="gallery-post-item">
                      <div className="gallery-media-wrapper">
                        <img src={art.file_path} alt={art.judul} className="gallery-media-img" />
                        {art.KATEGORI?.nama_kategori && <span className="category-tag-badge">{art.KATEGORI.nama_kategori}</span>}
                        <div className="gallery-media-overlay"></div>
                      </div>
                      <div className="gallery-actions-side">
                        <button type="button" className={`btn-action-like ${userHasLiked ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleLike(art.id_karya); }}>
                          {userHasLiked ? '❤️' : '🤍'}
                        </button>
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
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {currentView === 'polling' && (
        <section className="polling-view-container fade-in">
          <div className="polling-intro">
            <h2><MdHowToVote /> Polling Atribut Siswa</h2>
            <p>Berikan suaramu untuk teman yang paling menginspirasi!</p>
          </div>
          <div className="polling-cards-grid">
            {['Tercantik', 'Terganteng', 'Terpintar', 'Terajin', 'Terbaik', 'Termanis'].map((kat) => {
              const candidate = selectedCandidates[kat];
              const hasVoted = userVotes.includes(kat);
              const totalVotes = pollingStats[kat] || 0; // Mengambil total suara yang dihitung otomatis

              return (
                <div key={kat} className={`poll-card-item ${hasVoted ? 'voted-locked' : ''}`}>
                  {/* Indikator Jumlah Suara Terupdate Otomatis */}
                  <div className="vote-count-badge" style={{ position: 'absolute', top: '10px', right: '10px', background: '#007bff', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                    {totalVotes} Suara
                  </div>

                  <div className="poll-card-category">Gelar {kat}</div>
                  <div className="poll-card-avatar">
                    {candidate ? (
                      <div className="avatar-frame">
                        <img src={candidate.foto_url || "https://via.placeholder.com/150"} alt="selected" />
                        <div className="check-status">✓</div>
                      </div>
                    ) : ( <div className="avatar-placeholder-icon">?</div> )}
                  </div>
                  <div className="poll-card-body">
                    <h4 className="candidate-name">{candidate ? candidate.nama_lengkap : "Belum Ada Pilihan"}</h4>
                    {!hasVoted ? (
                      <select className="poll-select-input" onChange={(e) => handleVote(e.target.value, kat)} defaultValue="">
                        <option value="" disabled>Pilih Nama Siswa...</option>
                        {allStudents.map(s => <option key={s.id_user} value={s.id_user}>{s.nama_lengkap}</option>)}
                      </select>
                    ) : ( <div className="vote-confirmed-label">Suara Terkunci</div> )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {selectedKarya && (
        <div className="modal-overlay" onClick={() => { setSelectedKarya(null); window.history.back(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Komentar</h3>
              <button className="close-modal" onClick={() => { setSelectedKarya(null); window.history.back(); }}>✕</button>
            </div>
            <div className="comments-list">
              {loadingComments ? <p className="loading-text">Memuat... ⏳</p> : 
                comments.map((c) => (
                  <div key={c.id_interaksi} className="comment-item">
                    <img src={c.USER?.foto_url || "https://via.placeholder.com/40"} onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }} className="comment-avatar" style={{ cursor: 'pointer' }} alt="ava" />
                    <div className="comment-text-block">
                      <p className="comment-author-name" onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }} style={{ cursor: 'pointer' }}>{c.USER?.nama_lengkap}</p>
                      <p className="comment-text">{c.isi_komentar}</p>
                    </div>
                  </div>
                ))
              }
            </div>
            <form className="comment-form" onSubmit={handleSendComment}>
              <input type="text" placeholder="Tambahkan komentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button type="submit" className="btn-send">Kirim</button>
            </form>
          </div>
        </div>
      )}

      <footer className="footer"><p> GaleriDigital - SD Katolik 10 Santa Theresia Manado</p></footer>
    </div>
  );
};

export default UserDashboard;