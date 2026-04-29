import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sb } from '../../api/supabaseClient';
import './AdminDashboard.css';
import { fetchAllCommentsAdmin, deleteComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { 
  MdLogout, MdPeople, MdPalette, MdChat, MdFavorite, 
  MdDelete, MdStar, MdEmojiEvents, MdWorkspacePremium, MdClose 
} from "react-icons/md";

const AdminDashboard = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('validasi'); 
  const [pendingArtworks, setPendingArtworks] = useState([]);
  const [moderasiComments, setModerasiComments] = useState([]); 
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ likes: 0, comments: 0, totalSiswa: 0 });
  
  const [topRatedKarya, setTopRatedKarya] = useState([]);
  const [pollingWinners, setPollingWinners] = useState([]);
  
  // State untuk Modal Profile
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // State untuk fitur Checkbox
  const [selectedComments, setSelectedComments] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasFetchedData = useRef(false);

  const fetchAdminData = useCallback(async (showSilent = false) => {
    try {
      if (!showSilent) setIsInitialLoading(true);
      
      const [artworksRes, usersRes, likesRes, commentsRes, topKaryaRes, pollingRes] = await Promise.all([
        sb.from('KARYA').select(`*, USER!KARYA_id_user_fkey ( nama_lengkap )`).eq('status', 'menunggu'),
        sb.from('USER').select('*').eq('role', 'siswa'),
        sb.from('INTERAKSI').select('*', { count: 'exact', head: true }).eq('jenis_interaksi', 'like'),
        sb.from('INTERAKSI').select('*', { count: 'exact', head: true }).eq('jenis_interaksi', 'komentar'),
        sb.from('KARYA').select(`*, USER!KARYA_id_user_fkey(nama_lengkap), INTERAKSI(count)`).eq('status', 'publik'),
        // Mengambil data dari tabel POLLING sesuai struktur database Anda
        sb.from('POLLING').select(`kategori_polling, id_target_siswa, USER:id_target_siswa(*)`)
      ]);

      if (artworksRes.error) throw artworksRes.error;

      setPendingArtworks(artworksRes.data || []);
      setStudents(usersRes.data || []);
      setStats({ 
        likes: likesRes.count || 0, 
        comments: commentsRes.count || 0, 
        totalSiswa: usersRes.data?.length || 0 
      });

      const sortedKarya = (topKaryaRes.data || [])
        .map(item => ({ ...item, likeCount: item.INTERAKSI[0]?.count || 0 }))
        .sort((a, b) => b.likeCount - a.likeCount)
        .slice(0, 5);
      setTopRatedKarya(sortedKarya);

      // Logika Polling dengan Case Sensitivity (Huruf Kapital di Awal)
      if (pollingRes.data) {
        const categories = ['Tercantik', 'Terganteng', 'Terpintar', 'Terajin', 'Terbaik', 'Termanis'];
        const winners = categories.map(cat => {
          const votesForCat = pollingRes.data.filter(p => p.kategori_polling === cat);
          const counts = votesForCat.reduce((acc, curr) => {
            if (!curr.USER) return acc;
            const id = curr.id_target_siswa;
            if (!acc[id]) {
              acc[id] = { info: curr.USER, count: 0 };
            }
            acc[id].count++;
            return acc;
          }, {});

          const topStudent = Object.values(counts).sort((a, b) => b.count - a.count)[0];
          return { kategori: cat, student: topStudent?.info, totalSuara: topStudent?.count || 0 };
        });
        setPollingWinners(winners);
      }

      hasFetchedData.current = true;
    } catch (error) {
      toast.error("Gagal sinkronisasi data");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const fetchModerasiComments = async () => {
    const { data, error } = await fetchAllCommentsAdmin();
    if (!error) setModerasiComments(data || []);
  };

  useEffect(() => {
    if (!hasFetchedData.current) fetchAdminData();
    if (currentView === 'moderasi') fetchModerasiComments();

    const karyaChannel = sb.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'KARYA' }, () => fetchAdminData(true))
      .subscribe();

    return () => { sb.removeChannel(karyaChannel); };
  }, [fetchAdminData, currentView]);

  // Handler Actions
  const handleAction = async (id, newStatus) => {
    let alasan = null;
    if (newStatus === 'ditolak') {
      alasan = window.prompt("Berikan alasan penolakan:");
      if (!alasan) return;
    }
    setActionLoading(id);
    const { error } = await sb.from('KARYA').update({ status: newStatus, catatan_admin: alasan }).eq('id_karya', id);
    if (!error) {
      setPendingArtworks(prev => prev.filter(art => art.id_karya !== id));
      toast.success(`Karya berhasil di-${newStatus}`);
    } else {
      toast.error("Gagal update status");
    }
    setActionLoading(null);
  };

  const handleDeleteStudent = async (id, name) => {
    if (window.confirm(`Hapus siswa ${name}?`)) {
      const { error } = await sb.from('USER').delete().eq('id_user', id);
      if (!error) {
        setStudents(prev => prev.filter(s => s.id_user !== id));
        toast.success("Siswa dihapus");
      }
    }
  };

  const handleDeleteComment = async (id) => {
    if (window.confirm("Hapus komentar ini?")) {
      const { error } = await deleteComment(id);
      if (!error) {
        setModerasiComments(prev => prev.filter(c => c.id_interaksi !== id));
        toast.success("Komentar dihapus");
      }
    }
  };

  // Checkbox Handlers
  const toggleSelectComment = (id) => setSelectedComments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectStudent = (id) => setSelectedStudents(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  if (isInitialLoading) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="admin-wrapper">
      <Toaster position="top-right" />

      {/* MODAL DETAIL PROFIL */}
      {showModal && selectedProfile && (
        <div className="profile-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowModal(false)}><MdClose size={24}/></button>
            <div className="profile-header-color"></div>
            <div className="profile-body">
              <img src={selectedProfile.foto_url || "https://via.placeholder.com/120"} alt="Profile" className="profile-large-img" />
              <h2 className="profile-name">{selectedProfile.nama_lengkap}</h2>
              <p className="profile-username">@{selectedProfile.username}</p>
              <div className="profile-badge">
                <MdEmojiEvents color="#f1c40f" />
                <span>Pemenang {selectedProfile.category}</span>
              </div>
              <div className="profile-stats-mini">
                <div className="stat-box">
                  <strong>{selectedProfile.votes}</strong>
                  <span>Total Suara</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="admin-navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => setCurrentView('validasi')} style={{cursor:'pointer'}}>
             <span>Admin Galeri</span>
          </div>
          <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
            <li className={currentView === 'validasi' ? 'active' : ''} onClick={() => {setCurrentView('validasi'); setIsMenuOpen(false)}}>Validasi</li>
            <li className={currentView === 'laporan' ? 'active' : ''} onClick={() => {setCurrentView('laporan'); setIsMenuOpen(false)}}>Rating & Polling</li>
            <li className={currentView === 'moderasi' ? 'active' : ''} onClick={() => {setCurrentView('moderasi'); setIsMenuOpen(false)}}>Moderasi</li>
            <li className={currentView === 'siswa' ? 'active' : ''} onClick={() => {setCurrentView('siswa'); setIsMenuOpen(false)}}>Data Siswa</li>
            <button className="btn-logout" onClick={onLogout}><MdLogout size={18} /> Keluar</button>
          </ul>
          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? '✕' : '☰'}</button>
        </div>
      </nav>

      <main className="admin-main">
        {/* STATS SECTION - Tetap Muncul */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><MdPeople /></div>
              <div className="stat-info"><h3>{stats.totalSiswa}</h3><p>Total Siswa</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><MdPalette /></div>
              <div className="stat-info"><h3>{pendingArtworks.length}</h3><p>Antrean</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><MdFavorite /></div>
              <div className="stat-info"><h3>{stats.likes}</h3><p>Total Suka</p></div>
            </div>
          </div>
        </section>

        <div className="content-area">
            {/* VIEW: VALIDASI */}
            {currentView === 'validasi' && (
              <section className="admin-section fade-in">
                <h2 className="section-title">Validasi Antrean</h2>
                <div className="validation-list">
                  {pendingArtworks.length > 0 ? pendingArtworks.map((art) => (
                    <div key={art.id_karya} className="val-card">
                      <div className="val-img-wrapper">
                        <img src={art.file_path} alt="karya" />
                      </div>
                      <div className="val-details">
                        <h4>{art.judul}</h4>
                        <p>Oleh: <strong>{art.USER?.nama_lengkap}</strong></p>
                        <div className="val-actions">
                          <button className="btn-app" onClick={() => handleAction(art.id_karya, 'publik')}>Setujui</button>
                          <button className="btn-rej" onClick={() => handleAction(art.id_karya, 'ditolak')}>Tolak</button>
                        </div>
                      </div>
                    </div>
                  )) : <div className="empty-state">Antrean kosong ✨</div>}
                </div>
              </section>
            )}

            {/* VIEW: RATING & POLLING */}
            {currentView === 'laporan' && (
              <div className="report-container fade-in">
                <div className="report-grid">
                  <div className="report-card ranking-section">
                    <h3><MdStar /> Karya Terpopuler</h3>
                    <div className="rating-list">
                      {topRatedKarya.map((art, idx) => (
                        <div key={art.id_karya} className={`rating-card rank-${idx + 1}`}>
                          <img src={art.file_path} alt="karya" />
                          <div className="rating-details">
                            <h4>{art.judul}</h4>
                            <span className="like-pill"><MdFavorite /> {art.likeCount} Suka</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="report-card polling-section">
                    <h3><MdEmojiEvents /> Hasil Polling Siswa</h3>
                    <div className="polling-winner-grid">
                      {pollingWinners.map((win, idx) => (
                        <div 
                          key={idx} 
                          className="winner-mini-card"
                          onClick={() => win.student && setSelectedProfile({...win.student, category: win.kategori, votes: win.totalSuara}, setShowModal(true))}
                          style={{ cursor: win.student ? 'pointer' : 'default' }}
                        >
                          <div className="category-label">{win.kategori}</div>
                          {win.student ? (
                            <div className="winner-info">
                              <img src={win.student.foto_url || "https://via.placeholder.com/50"} alt="pemenang" />
                              <div><strong>{win.student.nama_lengkap}</strong><p>{win.totalSuara} Suara</p></div>
                            </div>
                          ) : <p className="no-data">Belum ada suara</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: MODERASI KOMENTAR */}
            {currentView === 'moderasi' && (
              <section className="admin-section fade-in">
                <h2 className="section-title">Moderasi Komentar</h2>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px', textAlign: 'center' }}>Pilih</th>
                        <th>User</th>
                        <th>Komentar</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderasiComments.map((com) => (
                        <tr key={com.id_interaksi}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={selectedComments.includes(com.id_interaksi)} onChange={() => toggleSelectComment(com.id_interaksi)} />
                          </td>
                          <td>{com.USER?.nama_lengkap}</td>
                          <td>"{com.isi_komentar}"</td>
                          <td><button className="btn-rej-row" onClick={() => handleDeleteComment(com.id_interaksi)}>Hapus</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* VIEW: DATA SISWA */}
            {currentView === 'siswa' && (
              <section className="admin-section fade-in">
                <h2 className="section-title">Kelola Data Siswa</h2>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px', textAlign: 'center' }}>Pilih</th>
                        <th>Nama</th>
                        <th>Username</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((std) => (
                        <tr key={std.id_user}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={selectedStudents.includes(std.id_user)} onChange={() => toggleSelectStudent(std.id_user)} />
                          </td>
                          <td>{std.nama_lengkap}</td>
                          <td>@{std.username}</td>
                          <td><button className="btn-delete-row" onClick={() => handleDeleteStudent(std.id_user, std.nama_lengkap)}><MdDelete /> Hapus</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;