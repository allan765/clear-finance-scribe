import {
  uploadReceiptFn,
  deleteReceiptFn,
  uploadMonthReceiptFn,
  deleteMonthReceiptFn,
} from "./db.functions";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64," prefix
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadReceipt(file: File, entryId: string) {
  const base64 = await fileToBase64(file);
  const res = await uploadReceiptFn({
    data: {
      entryId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      base64,
    },
  });
  return { path: res.path, url: res.url };
}

export async function deleteReceipt(path: string, entryId: string) {
  await deleteReceiptFn({ data: { entryId, path } });
}
