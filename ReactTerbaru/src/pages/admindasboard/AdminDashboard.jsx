import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sb } from '../../api/supabaseClient';
import './AdminDashboard.css';
import { fetchAllCommentsAdmin, deleteComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout, MdPeople, MdPalette, MdChat, MdFavorite, MdDelete } from "react-icons/md";

const AdminDashboard = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('validasi'); 
  const [pendingArtworks, setPendingArtworks] = useState([]);
  const [moderasiComments, setModerasiComments] = useState([]); 
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ likes: 0, comments: 0, totalSiswa: 0 });
  
  // State Baru untuk Bulk Delete
  const [selectedComments, setSelectedComments] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasFetchedData = useRef(false);

  const fetchAdminData = useCallback(async (showSilent = false) => {
    try {
      if (!showSilent) setIsInitialLoading(true);
      
      const [artworksRes, usersRes, likesRes, commentsRes] = await Promise.all([
        sb.from('KARYA').select(`*, USER!KARYA_id_user_fkey ( nama_lengkap )`).eq('status', 'menunggu'),
        sb.from('USER').select('*').eq('role', 'siswa'),
        sb.from('INTERAKSI').select('*', { count: 'exact', head: true }).eq('jenis_interaksi', 'like'),
        sb.from('INTERAKSI').select('*', { count: 'exact', head: true }).eq('jenis_interaksi', 'komentar')
      ]);

      if (artworksRes.error) throw artworksRes.error;

      setPendingArtworks(artworksRes.data || []);
      setStudents(usersRes.data || []);
      setStats({ 
        likes: likesRes.count || 0, 
        comments: commentsRes.count || 0, 
        totalSiswa: usersRes.data?.length || 0 
      });

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
    if (!hasFetchedData.current) {
      fetchAdminData();
    }

    if (currentView === 'moderasi' && moderasiComments.length === 0) {
      fetchModerasiComments();
    }

    const karyaChannel = sb.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'KARYA' }, () => fetchAdminData(true))
      .subscribe();

    return () => { sb.removeChannel(karyaChannel); };
  }, [fetchAdminData, currentView]);

  // --- LOGIKA CHECKBOX MODERASI ---
  const toggleSelect = (id) => {
    setSelectedComments(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedComments.length === moderasiComments.length) {
      setSelectedComments([]);
    } else {
      setSelectedComments(moderasiComments.map(c => c.id_interaksi));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedComments.length === 0) return;
    
    if (window.confirm(`Hapus ${selectedComments.length} komentar yang dipilih?`)) {
      setActionLoading('bulk-delete');
      try {
        const { error } = await sb
          .from('INTERAKSI')
          .delete()
          .in('id_interaksi', selectedComments);

        if (error) throw error;

        setModerasiComments(prev => prev.filter(c => !selectedComments.includes(c.id_interaksi)));
        setSelectedComments([]);
        toast.success(`${selectedComments.length} komentar berhasil dihapus!`);
      } catch (error) {
        toast.error("Gagal menghapus beberapa komentar");
      } finally {
        setActionLoading(null);
      }
    }
  };

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
    if (window.confirm(`Hapus siswa ${name}? Semua karya siswa ini juga akan terhapus.`)) {
      const { error } = await sb.from('USER').delete().eq('id_user', id);
      if (!error) {
        setStudents(prev => prev.filter(s => s.id_user !== id));
        toast.success("Siswa berhasil dihapus");
      }
    }
  };

  const handleDeleteComment = async (id) => {
    if (window.confirm("Hapus komentar ini?")) {
      const { error } = await deleteComment(id);
      if (!error) {
        setModerasiComments(prev => prev.filter(c => c.id_interaksi !== id));
        setSelectedComments(prev => prev.filter(item => item !== id));
        toast.success("Komentar dihapus");
      }
    }
  };

  if (isInitialLoading) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="admin-wrapper">
      <Toaster position="top-right" />
      <nav className="admin-navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => setCurrentView('validasi')} style={{cursor:'pointer'}}>
             <span>Admin Galeri</span>
          </div>
          <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
            <li className={currentView === 'validasi' ? 'active' : ''} 
                onClick={() => { setCurrentView('validasi'); setIsMenuOpen(false); }}>Validasi</li>
            <li className={currentView === 'moderasi' ? 'active' : ''} 
                onClick={() => { setCurrentView('moderasi'); setIsMenuOpen(false); }}>Moderasi</li>
            <li className={currentView === 'siswa' ? 'active' : ''} 
                onClick={() => { setCurrentView('siswa'); setIsMenuOpen(false); }}>Data Siswa</li>
            <button className="btn-logout" onClick={onLogout}>
              <MdLogout size={18} /> Keluar
            </button>
          </ul>
          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      <main className="admin-main">
        <section className="stats-section">
          <h2 className="section-title">Laporan Aktivitas Galeri</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><MdPeople /></div>
              <div className="stat-info"><h3>{stats.totalSiswa}</h3><p>Total Siswa</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><MdPalette /></div>
              <div className="stat-info"><h3>{pendingArtworks.length}</h3><p>Antrean Karya</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><MdFavorite /></div>
              <div className="stat-info"><h3>{stats.likes}</h3><p>Total Suka</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><MdChat /></div>
              <div className="stat-info"><h3>{stats.comments}</h3><p>Komentar</p></div>
            </div>
          </div>
        </section>

        <div className="content-area">
            {currentView === 'validasi' && (
              <section className="admin-section fade-in">
                <h2 className="section-title"> Validasi Antrean</h2>
                <div className="validation-list">
                  {pendingArtworks.length > 0 ? pendingArtworks.map((art) => (
                    <div key={art.id_karya} className="val-card">
                      <div className="val-img-wrapper">
                        <img src={art.file_path || "https://via.placeholder.com/150"} alt="karya" loading="lazy" />
                        <span className="category-badge">{art.kategori || 'Umum'}</span>
                      </div>
                      <div className="val-details">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4>{art.judul}</h4>
                          <span className="cat-text-inline">{art.kategori}</span>
                        </div>
                        <p className="author">Oleh: <strong>{art.USER?.nama_lengkap}</strong></p>
                        <p className="desc">{art.deskripsi || "Siswa tidak memberikan deskripsi."}</p>
                        <div className="val-actions">
                          <button className="btn-app" onClick={() => handleAction(art.id_karya, 'publik')} disabled={actionLoading === art.id_karya}>
                             {actionLoading === art.id_karya ? '...' : 'Setujui'}
                          </button>
                          <button className="btn-rej" onClick={() => handleAction(art.id_karya, 'ditolak')} disabled={actionLoading === art.id_karya}>Tolak</button>
                        </div>
                      </div>
                    </div>
                  )) : <div className="empty-state">Semua karya sudah divalidasi! ✨</div>}
                </div>
              </section>
            )}

            {currentView === 'moderasi' && (
              <section className="admin-section fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h2 className="section-title"> Moderasi Komentar</h2>
                  {selectedComments.length > 0 && (
                    <button className="btn-bulk-delete" onClick={handleBulkDelete} disabled={actionLoading === 'bulk-delete'}>
                      <MdDelete size={18} /> Hapus ({selectedComments.length})
                    </button>
                  )}
                </div>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th width="40">
                          <input 
                            type="checkbox" 
                            onChange={toggleSelectAll} 
                            checked={moderasiComments.length > 0 && selectedComments.length === moderasiComments.length}
                          />
                        </th>
                        <th>User</th>
                        <th>Komentar</th>
                        <th>Karya</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderasiComments.map((com) => (
                        <tr key={com.id_interaksi} className={selectedComments.includes(com.id_interaksi) ? 'row-selected' : ''}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedComments.includes(com.id_interaksi)}
                              onChange={() => toggleSelect(com.id_interaksi)}
                            />
                          </td>
                          <td>{com.USER?.nama_lengkap}</td>
                          <td><em>"{com.isi_komentar}"</em></td>
                          <td>{com.KARYA?.judul}</td>
                          <td>
                            <button className="btn-rej-row" onClick={() => handleDeleteComment(com.id_interaksi)}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {moderasiComments.length === 0 && <p className="empty-table">Tidak ada komentar untuk dimoderasi.</p>}
                </div>
              </section>
            )}

            {currentView === 'siswa' && (
              <section className="admin-section fade-in">
                <h2 className="section-title"> Kelola Data Siswa</h2>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Nama</th><th>Username</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                      {students.map((std) => (
                        <tr key={std.id_user}>
                          <td>{std.nama_lengkap}</td>
                          <td>@{std.username}</td>
                          <td>
                            <button className="btn-delete-row" onClick={() => handleDeleteStudent(std.id_user, std.nama_lengkap)}>
                              <MdDelete size={18} /> Hapus
                            </button>
                          </td>
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