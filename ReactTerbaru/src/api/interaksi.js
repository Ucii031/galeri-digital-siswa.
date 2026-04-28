import { sb } from "./supabaseClient.js";

//ambil komentar
export const fetchComments = async (idKarya) => {
  const { data, error } = await sb
    .from("INTERAKSI")
    .select(`
      id_interaksi,
      isi_komentar,
      tanggal_interaksi,
      id_user,
      USER (
        id_user, 
        nama_lengkap, 
        foto_url
      )
    `)
    .eq("id_karya", idKarya)
    .eq("jenis_interaksi", "komentar")
    .order("tanggal_interaksi", { ascending: true });

  return { data, error };
};

//ambil komentar untuk admin
export const fetchAllCommentsAdmin = async () => {
  const { data, error } = await sb
    .from("INTERAKSI")
    .select(`
      id_interaksi,
      isi_komentar,
      tanggal_interaksi,
      USER (
        id_user,
        nama_lengkap,
        foto_url
      ),
      KARYA (judul)
    `)
    .eq("jenis_interaksi", "komentar")
    .order("tanggal_interaksi", { ascending: false });

  return { data, error };
};



// tambah komentar baru
export const postComment = async (idKarya, idUser, teks) => {
  return await sb.from("INTERAKSI").insert([
    {
      id_karya: idKarya,
      id_user: idUser,
      isi_komentar: teks,
      jenis_interaksi: "komentar"
    }
  ]);
};

//hapus komenar
export const deleteComment = async (idInteraksi) => {
  return await sb.from("INTERAKSI").delete().eq("id_interaksi", idInteraksi);
};