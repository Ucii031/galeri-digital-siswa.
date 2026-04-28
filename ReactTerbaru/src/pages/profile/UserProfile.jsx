import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../api/supabaseClient';
import './UserProfile.css';
import { toast, Toaster } from 'react-hot-toast';
import { IoArrowBackOutline, IoTrashOutline, IoHeart } from "react-icons/io5";

const UserProfile = ({ user, onBack, onUpdate, viewingUser = null }) => {
  const isOwnProfile = !viewingUser || viewingUser.id_user === user.id_user;
  const targetUser = viewingUser || user;

  const [activeTab, setActiveTab] = useState('karya'); 
  const [myArtworks, setMyArtworks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArt, setSelectedArt] = useState(null);
  const [totalLikes, setTotalLikes] = useState(0); // State baru untuk total suka profil

  const fetchData = useCallback(async () => {
    if (!targetUser?.id_user) return;
    setLoading(true);
    try {
      // Mengambil karya + Kategori + Hitung Like per karya
      const { data: arts, error } = await sb
        .from('KARYA')
        .select(`
          *, 
          KATEGORI(nama_kategori),
          INTERAKSI(count)
        `)
        .eq('id_user', targetUser.id_user)
        .eq('INTERAKSI.jenis_interaksi', 'like')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const filteredArts = isOwnProfile ? arts : arts.filter(a => a.status === 'publik');
      setMyArtworks(filteredArts || []);

      // HITUNG TOTAL LIKE SELURUH KARYA UNTUK PROFIL
      const total = arts.reduce((acc, curr) => acc + (curr.INTERAKSI?.[0]?.count || 0), 0);
      setTotalLikes(total);

      const { data: cats } = await sb.from('KATEGORI').select('*');
      if (cats) setCategories(cats);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id_user, isOwnProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // FUNGSI HAPUS KARYA
  const handleDelete = async (id_karya, filePath) => {
    const confirmDelete = window.confirm("Hapus karya ini secara permanen?");
    if (!confirmDelete) return;

    try {
      const { error: dbError } = await sb.from('KARYA').delete().eq('id_karya', id_karya);
      if (dbError) throw dbError;

      const fileName = filePath.split('/').pop();
      await sb.storage.from('artworks').remove([fileName]);

      toast.success("Karya dihapus! 🗑️");
      setSelectedArt(null);
      fetchData();
    } catch (err) {
      toast.error("Gagal hapus: " + err.message);
    }
  };

  return (
    <div className="profile-container">
      <Toaster position="top-center" />
      <button className="btn-back-simple" onClick={onBack}>
        <IoArrowBackOutline size={22} />
      </button>

      <section className="profile-header-tiktok">
        <div className="avatar-wrapper">
          <img src={targetUser?.foto_url || "https://via.placeholder.com/150"} alt="Profile" />
        </div>
        <div className="profile-text">
          <h2 className="profile-username">@{targetUser?.username || "siswa"}</h2>
          <p className="profile-bio">{targetUser?.bio || "SD Katolik 10 Santa Theresia Manado"}</p>
          
          {/* STATISTIK DI BAWAH BIO */}
          <div className="profile-stats-row">
            <div className="stat-item">
              <strong>{myArtworks.length}</strong>
              <span>Karya</span>
            </div>
            <div className="stat-item">
              <strong>{totalLikes}</strong>
              <span>Suka</span>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-tabs">
        <button className={activeTab === 'karya' ? 'active' : ''} onClick={() => setActiveTab('karya')}> Karya</button>
        {isOwnProfile && (
          <>
            <button className={activeTab === 'upload' ? 'active' : ''} onClick={() => setActiveTab('upload')}> Unggah</button>
            <button className={activeTab === 'edit' ? 'active' : ''} onClick={() => setActiveTab('edit')}> Edit</button>
          </>
        )}
      </div>

      <div className="profile-content">
        {loading ? (
          <p className="loading-msg">Memuat data... </p>
        ) : activeTab === 'karya' ? (
          <GalleryGrid 
            artworks={myArtworks} 
            onItemClick={(art) => setSelectedArt(art)} 
          />
        ) : isOwnProfile && activeTab === 'upload' ? (
          <UploadWorkForm 
            user={user} 
            categories={categories} 
            onSuccess={() => { setActiveTab('karya'); fetchData(); }} 
          />
        ) : isOwnProfile && activeTab === 'edit' ? (
          <EditProfileForm 
            user={user} 
            onSuccess={(updatedData) => { 
                if (onUpdate) onUpdate(updatedData); 
                setActiveTab('karya'); 
            }} 
          />
        ) : null}
      </div>

      {/* Pop-up Detail Karya */}
      {selectedArt && (
        <div className="modal-overlay" onClick={() => setSelectedArt(null)}>
          <div className="modal-content-profile" onClick={(e) => e.stopPropagation()}>
            <button className="close-pop" onClick={() => setSelectedArt(null)}>✕</button>
            
            {isOwnProfile && (
              <button className="btn-delete-art" onClick={() => handleDelete(selectedArt.id_karya, selectedArt.file_path)}>
                <IoTrashOutline size={20} />
              </button>
            )}

            <img src={selectedArt.file_path} alt={selectedArt.judul} className="img-fluid-pop" />
            
            <div className="pop-info">
                <div className="pop-stats">
                  <span className="pop-cat-badge">{selectedArt.KATEGORI?.nama_kategori || 'Umum'}</span>
                  <span className="pop-like-count">
                    <IoHeart color="#ff4d4d" /> {selectedArt.INTERAKSI?.[0]?.count || 0} Suka
                  </span>
                </div>
                <h3>{selectedArt.judul}</h3>
                <p>{selectedArt.deskripsi}</p>
                <span className={`badge-status ${selectedArt.status}`}>
                  {selectedArt.status === 'publik' ? '✅ Publik' : ' Menunggu Review'}
                </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// sub komponen grid
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
        <div className="item-overlay">
          <div className="overlay-stats">
             <IoHeart /> {art.INTERAKSI?.[0]?.count || 0}
          </div>
          <small>{art.KATEGORI?.nama_kategori}</small>
          <span>{art.judul}</span>
        </div>
      </div>
    )) : <p className="empty-msg">Belum ada karya yang diunggah.</p>}
  </section>
);

//  Edit Profil 
const EditProfileForm = ({ user, onSuccess }) => {
    const [editData, setEditData] = useState({ 
      username: user.username || "", 
      bio: user.bio || "", 
      foto_file: null 
    });
    const [updating, setUpdating] = useState(false);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            let finalFotoUrl = user.foto_url;
            if (editData.foto_file) {
                const fileExt = editData.foto_file.name.split('.').pop();
                const fileName = `avatar_${user.id_user}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await sb.storage.from('uploads').upload(fileName, editData.foto_file);
                if (uploadError) throw uploadError;
                const { data } = sb.storage.from('uploads').getPublicUrl(fileName);
                finalFotoUrl = `${data.publicUrl}?t=${new Date().getTime()}`;
            }
            const { error: dbError } = await sb.from('USER')
              .update({ username: editData.username, bio: editData.bio, foto_url: finalFotoUrl })
              .eq('id_user', user.id_user);

            if (dbError) throw dbError;
            toast.success("Profil diperbarui! ");
            onSuccess({ username: editData.username, bio: editData.bio, foto_url: finalFotoUrl });
        } catch (err) { toast.error("Gagal: " + err.message); }
        finally { setUpdating(false); }
    };

    return (
        <form className="form-manage" onSubmit={handleUpdate}>
            <h3>Edit Profil</h3>
            <div className="input-group">
              <input type="file" accept="image/*" onChange={e => setEditData({...editData, foto_file: e.target.files[0]})} />
            </div>
            <div className="input-group">
              <input type="text" placeholder='Username' value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} />
            </div>
            <div className="input-group">
              <textarea placeholder='Bio' value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
            </div>
            <button type="submit" disabled={updating}>{updating ? "Menyimpan..." : "Simpan Perubahan"}</button>
        </form>
    );
};

//  Unggah Karya
const UploadWorkForm = ({ user, categories, onSuccess }) => {
    const [form, setForm] = useState({ judul: "", deskripsi: "", file: null, id_kategori: "" });
    const [upLoading, setUpLoading] = useState(false);
  
    const handleUpload = async (e) => {
      e.preventDefault();
      if (!form.file) return toast.error("Pilih file karya!");
      setUpLoading(true);
      try {
        const fileName = `art_${Date.now()}_${form.file.name}`;
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
        toast.success("Karya terkirim! Menunggu review.");
        onSuccess();
      } catch (err) { toast.error(err.message); }
      finally { setUpLoading(false); }
    };
  
    return (
      <form className="form-manage" onSubmit={handleUpload}>
        <h3>Unggah Karya</h3>
        <input type="text" placeholder="Judul Karya" required onChange={e => setForm({...form, judul: e.target.value})} />
        <textarea placeholder="Deskripsi karya..." onChange={e => setForm({...form, deskripsi: e.target.value})} />
        <select required value={form.id_kategori} onChange={e => setForm({...form, id_kategori: e.target.value})}>
          <option value="">-- Pilih Kategori --</option>
          {categories.map(c => <option key={c.id_kategori} value={c.id_kategori}>{c.nama_kategori}</option>)}
        </select>
        <input type="file" accept="image/*" required onChange={e => setForm({...form, file: e.target.files[0]})} />
        <button type="submit" disabled={upLoading}>{upLoading ? "Mengirim..." : "Kirim Sekarang"}</button>
      </form>
    );
};

export default UserProfile;