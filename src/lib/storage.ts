import { supabase } from "@/integrations/supabase/client";

export async function uploadReceipt(file: File, entryId: string) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${entryId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function deleteReceipt(path: string) {
  await supabase.storage.from("receipts").remove([path]);
}
