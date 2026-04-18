import { sb } from "./supabaseClient.js"; 

const generateEmail = (nama) => `${nama.trim().toLowerCase().replace(/\s/g, "")}@portofolio.com`;

export const registerUser = async (nama, password, bio) => {
  const email = generateEmail(nama);
  try {
    const { data: authData, error: authError } = await sb.auth.signUp({ email, password });
    if (authError) throw authError;

    if (authData.user) {
      const { error: dbError } = await sb.from("USER").insert([
        { id_user: authData.user.id, username: email, nama_lengkap: nama, role: "siswa", bio: bio }
      ]);
      if (dbError) throw dbError;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (nama, password) => {
  const email = generateEmail(nama);
  try {
    const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const { data: userData, error: dbError } = await sb
      .from("USER").select("role").eq("id_user", authData.user.id).single();

    if (dbError) throw new Error("Data profil tidak ditemukan.");
    return { success: true, role: userData.role };
  } catch (error) {
    return { success: false, error: error.message };
  }
};