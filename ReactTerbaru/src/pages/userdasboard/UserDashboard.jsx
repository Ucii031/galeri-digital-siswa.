import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserDashboard.css';
import UserProfile from "../profile/UserProfile";
import { fetchComments, postComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout, MdHowToVote } from "react-icons/md";
import confetti from 'canvas-confetti';

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
  const [pollingStats, setPollingStats] = useState({});

  // --- LOGIKA FETCH DATA POLLING ---
  const fetchPollingContext = useCallback(async () => {
    try {
      const { data: students } = await sb.from('USER').select('id_user, nama_lengkap, foto_url').eq('role', 'siswa');
      const { data: allVotes } = await sb.from('POLLING').select('kategori_polling');
      const { data: myVotes } = await sb.from('POLLING').select('kategori_polling, id_target_siswa').eq('id_pemilih', currentUserData.id_user);
      
      setAllStudents(students || []);
      setUserVotes(myVotes?.map(v => v.kategori_polling) || []);

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

  // ANIMASI CELEBRATION
  const triggerCelebration = () => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6']
    });
  };

  const handleVote = async (studentId, kategori) => {
    const studentObj = allStudents.find(s => s.id_user === studentId);
    const { error } = await sb.from('POLLING').insert([{
      id_pemilih: currentUserData.id_user,
      id_target_siswa: studentId,
      kategori_polling: kategori
    }]);

    if (!error) {
      triggerCelebration();
      toast.success(`Hore! Berhasil memilih ${studentObj.nama_lengkap}! 🎉`);
      setUserVotes([...userVotes, kategori]);
      setSelectedCandidates(prev => ({ ...prev, [kategori]: studentObj }));
      
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
      
      confetti({ particleCount: 30, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 30, angle: 120, spread: 55, origin: { x: 1 } });
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
    <div className="dashboard-wrapper childish-theme">
      <Toaster position="top-center" />
      
      <nav className="navbar animated-navbar">
        <div className="logo bounce-hover" onClick={() => navigateTo('beranda')}>
          <img className='logo1' src="icon.ico" alt="logo" />
          <span className="logo-text-kid">Galeri🎨Kita</span>
        </div>

        {isMenuOpen && <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}></div>}

        <ul className={`nav-linkss ${isMenuOpen ? 'active' : ''}`}>
          <li><a href="#beranda" className={currentView === 'beranda' ? 'active' : ''} onClick={(e) => { e.preventDefault(); navigateTo('beranda'); }}>🏠 Beranda</a></li>
          <li><a href="#polling" className={currentView === 'polling' ? 'active' : ''} onClick={(e) => { e.preventDefault(); navigateTo('polling'); }}>🗳️ Polling Seru</a></li>
          <li><a href="#galeri-fullscreen" onClick={() => setIsMenuOpen(false)}>🖼️ Lihat Galeri</a></li>
          <li><a href="#profile" onClick={(e) => { e.preventDefault(); navigateTo('profile'); }}>⭐ Profilku</a></li>
          <li><button className="btn-logout kid-logout" onClick={onLogout}><MdLogout size={18} /> Keluar</button></li>
        </ul>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {currentView === 'beranda' && (
        <div className="fade-in-view">
          <section className="hero kid-hero">
            {/* ELEMEN DEKORASI ANIMASI BERGERAK */}
            <div className="cloud-animation-container">
              <img className='awan awan-1' src="Awan.png" alt="awan" />
              <img className='awan awan-2' src="Awan.png" alt="awan" />
              <div className="floating-balloon">🎈</div>
              <div className="floating-kite">🪁</div>
            </div>
            
            <div className="hero-content">
              {/* ELEMEN KERLIPAN BINTANG */}
              <div className="sparkle-decorations">
                <span className="star-sparkle s1">⭐</span>
                <span className="star-sparkle s2">✨</span>
                <span className="star-sparkle s3">✨</span>
              </div>

              <img className='logo-2 pulse-animation' src="logo.png" alt="logo" />
              <span className="hero-badge kid-badge">👋 Halo, Anak Pintar {currentUserData?.nama_lengkap?.split(' ')[0]}!</span>
              <h1 className="hero-title kid-title">Toko Kreativitas <span className="highlight-kid">Karya Kita</span></h1>
              <p className="hero-subtitle kid-subtitle">Yuk, lihat karya-karya keren buatan teman sekolahmu! 🌟</p>
              <div className="hero-buttons">
                <button className="btn btn-primary btn-kid bounce-hover" onClick={() => navigateTo('profile')}>📤 Unggah Karyamu</button>
                <a href="#galeri-fullscreen" className="btn btn-secondary btn-kid-secondary bounce-hover" onClick={() => setIsMenuOpen(false)}>🖼️ Masuk Galeri</a>
              </div>
            </div>
          </section>

          <section id="galeri-fullscreen" className="gallery-section-fullscreen">
            <div className="gallery-controls">
              <div className="search-box kid-search">
                <input type="search" placeholder="🔎 Cari karya hebat atau nama teman..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            {loading ? (
              <div className="loading-state-kid">
                <div className="spinner-kid">🎨</div>
                <p>Sedang menata lukisan galeri... Tunggu ya! ⏳</p>
              </div>
            ) : (
              <div className="gallery-snap-container">
                {filteredKarya.map((art) => {
                  const userHasLiked = art.INTERAKSI?.some(i => i.id_user === currentUserData.id_user && i.jenis_interaksi === 'like');
                  return (
                    <div key={art.id_karya} className="gallery-post-item kid-card">
                      <div className="gallery-media-wrapper">
                        <img src={art.file_path} alt={art.judul} className="gallery-media-img" />
                        {art.KATEGORI?.nama_kategori && <span className="category-tag-badge kid-tag">{art.KATEGORI.nama_kategori}</span>}
                        <div className="gallery-media-overlay"></div>
                      </div>
                      <div className="gallery-actions-side kid-actions">
                        <button type="button" className={`btn-action-like pop-hover ${userHasLiked ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleLike(art.id_karya); }}>
                          {userHasLiked ? '❤️' : '🤍'}
                        </button>
                        <button className="btn-action-comment pop-hover" onClick={() => handleOpenComments(art)}>💬</button>
                      </div>
                      <div className="gallery-post-info">
                        <div className="author-container clickable-avatar" onClick={() => handleViewFriendProfile(art.USER)}>
                          <img src={art.USER?.foto_url || "https://via.placeholder.com/40"} alt="avatar" className="author-avatar-small kid-avatar" />
                          <h4 className="art-author-name">@{art.USER?.nama_lengkap?.split(' ')[0].toLowerCase()}</h4>
                        </div>
                        <h3 className="art-post-title kid-post-title">{art.judul}</h3>
                        <p className="art-post-desc kid-post-desc">{art.deskripsi || "Temanmu belum menulis cerita tentang karya ini."}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {currentView === 'polling' && (
        <section className="polling-view-container page-slide-up">
          <div className="polling-intro kid-poll-intro">
            <h2><MdHowToVote className="bounce-animation" /> 🗳️ Mahkota Penghargaan Juara</h2>
            <p>Pilih sahabat terbaikmu di sekolah untuk mendapatkan predikat ter-favorit! ✨</p>
          </div>
          <div className="polling-cards-grid">
            {['Tercantik', 'Terganteng', 'Terpintar', 'Terajin', 'Terbaik', 'Termanis'].map((kat) => {
              const candidate = selectedCandidates[kat];
              const hasVoted = userVotes.includes(kat);
              const totalVotes = pollingStats[kat] || 0;

              return (
                <div key={kat} className={`poll-card-item kid-poll-card ${hasVoted ? 'voted-locked-kid' : 'pop-entry'}`}>
                  <div className="vote-count-badge kid-vote-badge">
                    🏆 {totalVotes} Jempol
                  </div>

                  <div className="poll-card-category kid-category">✨ Paling {kat} ✨</div>
                  <div className="poll-card-avatar">
                    {candidate ? (
                      <div className="avatar-frame kid-frame-active">
                        <img src={candidate.foto_url || "https://via.placeholder.com/150"} alt="selected" />
                        <div className="check-status-kid">⭐</div>
                      </div>
                    ) : ( <div className="avatar-placeholder-icon kid-placeholder">?</div> )}
                  </div>
                  <div className="poll-card-body">
                    <h4 className="candidate-name kid-candidate-name">{candidate ? `🎉 ${candidate.nama_lengkap}` : "Siapa pilihanmu?"}</h4>
                    {!hasVoted ? (
                      <select className="poll-select-input kid-select" onChange={(e) => handleVote(e.target.value, kat)} defaultValue="">
                        <option value="" disabled>Pilih nama temanmu...</option>
                        {allStudents.map(s => <option key={s.id_user} value={s.id_user}>👦👧 {s.nama_lengkap}</option>)}
                      </select>
                    ) : ( <div className="vote-confirmed-label-kid">Pilihan Terkunci 🔒</div> )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {selectedKarya && (
        <div className="modal-overlay pop-in" onClick={() => { setSelectedKarya(null); window.history.back(); }}>
          <div className="modal-content kid-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header kid-modal-header">
              <h3>💬 Obrolan Seru</h3>
              <button className="close-modal" onClick={() => { setSelectedKarya(null); window.history.back(); }}>✕</button>
            </div>
            <div className="comments-list">
              {loadingComments ? <p className="loading-text">Membuka kotak pesan... ⏳</p> : 
                comments.map((c) => (
                  <div key={c.id_interaksi} className="comment-item kid-comment">
                    <img src={c.USER?.foto_url || "https://via.placeholder.com/40"} onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }} className="comment-avatar kid-comment-avatar" alt="ava" />
                    <div className="comment-text-block kid-comment-box">
                      <p className="comment-author-name" onClick={() => { setSelectedKarya(null); handleViewFriendProfile(c.USER); }}>{c.USER?.nama_lengkap}</p>
                      <p className="comment-text">{c.isi_komentar}</p>
                    </div>
                  </div>
                ))
              }
            </div>
            <form className="comment-form kid-form" onSubmit={handleSendComment}>
              <input type="text" placeholder="Tulis pujian manis untuk temanmu di sini..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button type="submit" className="btn-send kid-btn-send">Kirim 🚀</button>
            </form>
          </div>
        </div>
      )}

      <footer className="footer kid-footer">
        <p>🎈 GaleriDigital - SD Katolik 10 Santa Theresia Manado 🎈</p>
      </footer>
    </div>
  );
};

export default UserDashboard;