import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserProfile.css';
import { toast, Toaster } from 'react-hot-toast';
import { IoArrowBackOutline } from "react-icons/io5";
import { fetchComments, postComment, deleteComment } from '../../api/interaksi';

const UserProfile = ({ user, onBack, viewingUser = null }) => {
  const isOwnProfile = !viewingUser || viewingUser.id_user === user.id_user;
  const targetUser = viewingUser || user;
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('karya'); 
  const [myArtworks, setMyArtworks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArt, setSelectedArt] = useState(null);

  const fetchData = useCallback(async () => {
    if (!targetUser?.id_user) return;
    setLoading(true);
    try {
      const query = sb.from('KARYA').select('*').eq('id_user', targetUser.id_user);
      if (!isOwnProfile) {
        query.eq('status', 'publik');
      }
      const { data: arts } = await query.order('created_at', { ascending: false });
      setMyArtworks(arts || []);

      const { data: cats } = await sb.from('KATEGORI').select('*');
      if (cats) setCategories(cats);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id_user, isOwnProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="profile-container">
      <button className="btn-back-simple" onClick={onBack}>
        <IoArrowBackOutline size={22} />
        <span></span>
      </button>

      <section className="profile-header-tiktok">
        <div className="avatar-wrapper">
          <img src={targetUser?.foto_url || "https://via.placeholder.com/150"} alt="Profile" />
        </div>
        <div className="profile-text">
          <h2 className="profile-username">@{targetUser?.username || "siswa"}</h2>
          <p className="profile-bio">{targetUser?.bio || "SD Katolik 10 Santa Theresia Manado"}</p>
        </div>
      </section>

      <div className="profile-tabs">
        <button className={activeTab === 'karya' ? 'active' : ''} onClick={() => setActiveTab('karya')}>🖼️ Karya</button>
        {isOwnProfile && (
          <>
            <button className={activeTab === 'upload' ? 'active' : ''} onClick={() => setActiveTab('upload')}>📤 Unggah</button>
            <button className={activeTab === 'edit' ? 'active' : ''} onClick={() => setActiveTab('edit')}>⚙️ Edit</button>
          </>
        )}
        {isAdmin && isOwnProfile && (
          <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>🛡️ Moderasi</button>
        )}
      </div>

      <div className="profile-content">
        {activeTab === 'karya' && (
          <GalleryGrid 
            artworks={myArtworks} 
            onItemClick={(art) => setSelectedArt(art)} 
          />
        )}
        
        {isOwnProfile && activeTab === 'upload' && (
          <UploadWorkForm 
            user={user} 
            categories={categories} 
            onSuccess={() => { setActiveTab('karya'); fetchData(); }} 
          />
        )}
        
        {isOwnProfile && activeTab === 'edit' && (
          <EditProfileForm 
            user={user} 
            onSuccess={() => { 
                toast.success("Profil diperbarui!");
                setTimeout(() => window.location.reload(), 1000); 
            }} 
          />
        )}

        {isAdmin && isOwnProfile && activeTab === 'admin' && (
          <AdminApprovalPanel />
        )}
      </div>

      {/* Pop-up Karya */}
      {selectedArt && (
        <div className="modal-overlay" onClick={() => setSelectedArt(null)}>
          <div className="modal-content-profile" onClick={(e) => e.stopPropagation()}>
            <button className="close-pop" onClick={() => setSelectedArt(null)}>✕</button>
            <img src={selectedArt.file_path} alt={selectedArt.judul} className="img-fluid-pop" />
            <div className="pop-info">
               <h3>{selectedArt.judul}</h3>
               <p>{selectedArt.deskripsi}</p>
               <span className={`badge-status ${selectedArt.status}`}>
                 {selectedArt.status === 'publik' ? '✅ Publik' : '⏳ Menunggu Review'}
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-Komponen Galeri
const GalleryGrid = ({ artworks, onItemClick }) => (
  <section className="gallery-grid">
    {artworks.length > 0 ? artworks.map((art) => (
      <div key={art.id_karya} className="gallery-item-profile" onClick={() => onItemClick(art)}>
        <img 
          src={art.file_path} 
          alt={art.judul} 
          style={{ 
            opacity: art.status === 'menunggu' ? 0.4 : 1,
            filter: art.status === 'menunggu' ? 'grayscale(100%)' : 'none' 
          }} 
        />
        {art.status === 'menunggu' && <div className="status-badge pending">⏳ Menunggu</div>}
        <div className="item-overlay"><span>{art.judul}</span></div>
      </div>
    )) : <p className="empty-msg">Belum ada karya.</p>}
  </section>
);

//  formu Unggah Karya
const UploadWorkForm = ({ user, categories, onSuccess }) => {
    const [form, setForm] = useState({ judul: "", deskripsi: "", file: null, id_kategori: "" });
    const [upLoading, setUpLoading] = useState(false);
  
    const handleUpload = async (e) => {
      e.preventDefault();
      if (!form.file) return toast.error("Pilih file karya!");
      setUpLoading(true);
      try {
        const fileName = `${Date.now()}_${form.file.name}`;
        const { error: storageErr } = await sb.storage.from('artworks').upload(fileName, form.file);
        if (storageErr) throw storageErr;
        const { data } = sb.storage.from('artworks').getPublicUrl(fileName);
        const { error: dbErr } = await sb.from('KARYA').insert([{
          id_user: user.id_user,
          judul: form.judul,
          deskripsi: form.deskripsi,
          id_kategori: form.id_kategori,
          file_path: data.publicUrl,
          status: 'menunggu'
        }]);
        if (dbErr) throw dbErr;
        toast.success("Karya berhasil dikirim!");
        onSuccess();
      } catch (err) { toast.error(err.message); }
      finally { setUpLoading(false); }
    };
  
    return (
      <form className="form-manage" onSubmit={handleUpload}>
        <h3>Unggah Karya Baru</h3>
        <input type="text" placeholder="Judul" required onChange={e => setForm({...form, judul: e.target.value})} />
        <textarea placeholder="Deskripsi..." onChange={e => setForm({...form, deskripsi: e.target.value})} />
        <select required onChange={e => setForm({...form, id_kategori: e.target.value})}>
          <option value="">Kategori</option>
          {categories.map(c => <option key={c.id_kategori} value={c.id_kategori}>{c.nama_kategori}</option>)}
        </select>
        <input type="file" accept="image/*" required onChange={e => setForm({...form, file: e.target.files[0]})} />
        <button type="submit" disabled={upLoading}>{upLoading ? "Mengirim..." : "Kirim"}</button>
      </form>
    );
};

const EditProfileForm = ({ user, onSuccess }) => {
    const [editData, setEditData] = useState({ username: user.username || "", bio: user.bio || "", foto_file: null });
    const [updating, setUpdating] = useState(false);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            let finalFotoUrl = user.foto_url;
            if (editData.foto_file) {
                const fileName = `avatar_${user.id_user}_${Date.now()}`;
                await sb.storage.from('uploads').upload(fileName, editData.foto_file);
                const { data } = sb.storage.from('uploads').getPublicUrl(fileName);
                finalFotoUrl = data.publicUrl;
            }
            await sb.from('USER').update({ username: editData.username, bio: editData.bio, foto_url: finalFotoUrl }).eq('id_user', user.id_user);
            onSuccess();
        } catch (err) { toast.error(err.message); }
        finally { setUpdating(false); }
    };

    return (
        <form className="form-manage" onSubmit={handleUpdate}>
            <h3>Edit Profil</h3>
            <input type="file" onChange={e => setEditData({...editData, foto_file: e.target.files[0]})} />
            <input type="text" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} />
            <textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
            <button type="submit" disabled={updating}>Simpan</button>
        </form>
    );
};

const AdminApprovalPanel = () => {
    const [pendingArts, setPendingArts] = useState([]);
    const fetchPending = async () => {
        const { data } = await sb.from('KARYA').select('*, USER(username)').eq('status', 'menunggu');
        setPendingArts(data || []);
    };
    useEffect(() => { fetchPending(); }, []);
    const handleApprove = async (id) => {
        const { error } = await sb.from('KARYA').update({ status: 'publik' }).eq('id_karya', id);
        if (!error) { toast.success("Karya disetujui!"); fetchPending(); }
    };

    return (
        <div className="admin-panel">
            {pendingArts.map(art => (
                <div key={art.id_karya} className="admin-card">
                    <img src={art.file_path} alt="karya" />
                    <div>
                        <h4>{art.judul}</h4>
                        <button onClick={() => handleApprove(art.id_karya)}>Setujui ✅</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserProfile;