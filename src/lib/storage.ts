import {
  uploadReceiptFn,
  deleteReceiptFn,
  uploadMonthReceiptFn,
  createMonthReceiptUploadFn,
  finalizeMonthReceiptUploadFn,
  deleteMonthReceiptFn,
} from "./db.functions";

const MAX_MONTH_RECEIPT_BYTES = 50 * 1024 * 1024;

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

export async function uploadMonthReceipt(file: File, monthId: string) {
  if (file.size > MAX_MONTH_RECEIPT_BYTES) {
    throw new Error("Arquivo muito grande (máx 50 MB)");
  }

  try {
    const upload = await createMonthReceiptUploadFn({
      data: {
        monthId,
        filename: file.name,
        contentType: file.type || "application/pdf",
        size: file.size,
      },
    });

    const { error: uploadError } = await (await import("@/integrations/supabase/client")).supabase.storage
      .from("receipts")
      .uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: file.type || "application/pdf",
      });
    if (uploadError) throw new Error(uploadError.message);

    const res = await finalizeMonthReceiptUploadFn({ data: { monthId, path: upload.path } });
    return { path: res.path, url: res.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const shouldFallback = /signed|token|upload url|not found/i.test(message);
    if (!shouldFallback || file.size > 25 * 1024 * 1024) throw err;
  }

  const base64 = await fileToBase64(file);
  const res = await uploadMonthReceiptFn({
    data: {
      monthId,
      filename: file.name,
      contentType: file.type || "application/pdf",
      base64,
    },
  });
  return { path: res.path, url: res.url };
}

export async function deleteMonthReceipt(monthId: string) {
  await deleteMonthReceiptFn({ data: { monthId } });
}
