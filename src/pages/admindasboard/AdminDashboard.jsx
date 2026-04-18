import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './AdminDashboard.css';
import { fetchAllCommentsAdmin, deleteComment } from '../../api/interaksi';
import { Toaster, toast } from 'react-hot-toast';
import { MdLogout, MdPeople, MdPalette, MdChat, MdFavorite, MdDelete, MdCheckCircle, MdCancel } from "react-icons/md";

const AdminDashboard = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('validasi'); 
  const [pendingArtworks, setPendingArtworks] = useState([]);
  const [moderasiComments, setModerasiComments] = useState([]); 
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ likes: 0, comments: 0, totalSiswa: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      //ambil karya status 'menunggu'
      const { data: artworks, error: artError } = await sb
        .from('KARYA')
        .select(`*,USER!KARYA_id_user_fkey ( nama_lengkap )`)
        .eq('status', 'menunggu');
      
      if (artError) throw artError;

      // daftar siswa
      const { data: userList, error: userError } = await sb
        .from('USER')
        .select('*')
        .eq('role', 'siswa');

      if (userError) throw userError;

      //Laporan Aktivitas
      const { count: likeCount } = await sb.from('INTERAKSI')
        .select('*', { count: 'exact', head: true })
        .eq('jenis_interaksi', 'like');
        
      const { count: commentCount } = await sb.from('INTERAKSI')
        .select('*', { count: 'exact', head: true })
        .eq('jenis_interaksi', 'komentar');
      
      setPendingArtworks(artworks || []);
      setStudents(userList || []);
      setStats({ 
        likes: likeCount || 0, 
        comments: commentCount || 0, 
        totalSiswa: userList?.length || 0 
      });

    } catch (error) {
      toast.error("Gagal ambil data: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchModerasiComments = async () => {
    const { data, error } = await fetchAllCommentsAdmin();
    if (!error) setModerasiComments(data || []);
  };

  useEffect(() => {
    fetchAdminData();
    if (currentView === 'moderasi') fetchModerasiComments();

    const karyaChannel = sb.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'KARYA' }, () => fetchAdminData())
      .subscribe();

    return () => { sb.removeChannel(karyaChannel); };
  }, [fetchAdminData, currentView]);

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
      toast.success(`Karya ${newStatus}!`);
    } else {
      toast.error("Gagal update status");
    }
    setActionLoading(null);
  };

  const handleDeleteComment = async (id) => {
    if (window.confirm("Hapus komentar tidak pantas ini?")) {
      const { error } = await deleteComment(id);
      if (!error) {
        setModerasiComments(prev => prev.filter(c => c.id_interaksi !== id));
        toast.success("Komentar dihapus");
      }
    }
  };

  const handleDeleteStudent = async (id, name) => {
    if (window.confirm(`Hapus siswa ${name}? Semua karyanya juga akan terhapus.`)) {
      const { error } = await sb.from('USER').delete().eq('id_user', id);
      if (!error) {
        setStudents(prev => prev.filter(s => s.id_user !== id));
        toast.success("Data siswa berhasil dihapus");
      }
    }
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="admin-wrapper">
      <Toaster position="top-right" />
      <nav className="admin-navbar">
        <div className="nav-container">
          <div className="nav-logo">📊 <span>Admin Galeri</span></div>
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
        {/* Aktivitas*/}
        <section className="stats-section">
          <h2 className="section-title"> Laporan Aktivitas Galeri</h2>
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

        {/*validasi karya*/}
        {currentView === 'validasi' && (
          <section className="admin-section fade-in">
            <h2 className="section-title">✅ Validasi Antrean</h2>
            <div className="validation-list">
              {pendingArtworks.length > 0 ? pendingArtworks.map((art) => (
                <div key={art.id_karya} className="val-card">
                  <div className="val-img-wrapper">
                    <img src={art.file_path || "https://via.placeholder.com/150"} alt="karya" />
                  </div>
                  <div className="val-details">
                    <h4>{art.judul}</h4>
                    <p className="author">Oleh: <strong>{art.USER?.nama_lengkap}</strong></p>
                    <p className="desc">{art.deskripsi || "Siswa tidak memberikan deskripsi."}</p>
                    <div className="val-actions">
                      <button className="btn-app" onClick={() => handleAction(art.id_karya, 'publik')} disabled={actionLoading === art.id_karya}>Setujui</button>
                      <button className="btn-rej" onClick={() => handleAction(art.id_karya, 'ditolak')} disabled={actionLoading === art.id_karya}>Tolak</button>
                    </div>
                  </div>
                </div>
              )) : <div className="empty-state">Semua karya bersih!</div>}
            </div>
          </section>
        )}

        {/* Komentar*/}
        {currentView === 'moderasi' && (
          <section className="admin-section fade-in">
            <h2 className="section-title">🛡️ Moderasi Komentar</h2>
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr><th>User</th><th>Komentar</th><th>Karya</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {moderasiComments.map((com) => (
                    <tr key={com.id_interaksi}>
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
            </div>
          </section>
        )}

        {/*kelola data siswa*/}
        {currentView === 'siswa' && (
          <section className="admin-section fade-in">
            <h2 className="section-title">👥 Kelola Data Siswa</h2>
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
      </main>
    </div>
  );
};

export default AdminDashboard;