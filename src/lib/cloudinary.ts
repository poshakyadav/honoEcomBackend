import { v2 as cloudinary } from "cloudinary";
import { Context } from "hono";
import { Env } from "../types";

export function initCloudinary(c: Context<Env>) {
  cloudinary.config({
    cloud_name: c.env.CLOUDINARY_CLOUD_NAME,
    api_key: c.env.CLOUDINARY_API_KEY,
    api_secret: c.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export async function uploadImages(
  c: Context<Env>,
  files: File[],
  folder: string = "products"
) {
  const cl = initCloudinary(c);
  const results: { url: string; public_id: string }[] = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const upload = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        cl.uploader
          .upload_stream({ folder }, (error, result) => {
            if (error) reject(error);
            else resolve(result!);
          })
          .end(Buffer.from(buffer));
      }
    );
    results.push({ url: upload.secure_url, public_id: upload.public_id });
  }
  return results;
}

export async function deleteImages(c: Context<Env>, publicIds: string[]) {
  const cl = initCloudinary(c);
  for (const pid of publicIds) {
    if (pid) await cl.uploader.destroy(pid);
  }
}
