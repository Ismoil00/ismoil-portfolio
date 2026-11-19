import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const backend = `${process.env.API_URL ?? "http://localhost:8000"}/api/v1`;

/**
 * Big files on Vercel (a request to this app or the backend can't exceed 4.5 MB there): the browser
 * asks here for a short-lived token, then uploads the file straight to Vercel Blob.
 *
 * The backend decides who may upload what: the browser's session cookie, CSRF token and Origin are
 * passed on, and the backend answers with the size limit for the staging path (or refuses it).
 * Needs BLOB_READ_WRITE_TOKEN (added to the project when the Blob store is connected to it).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Direct uploads aren't set up." }, { status: 404 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const response = await fetch(`${backend}/admin/media/direct/authorize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") ?? "",
            Origin: request.headers.get("origin") ?? "",
            "X-CSRF-Token": request.headers.get("x-csrf-token") ?? "",
          },
          body: JSON.stringify({ pathname }),
          cache: "no-store",
        });
        if (response.status === 401) throw new Error("Your session has ended. Sign in again.");
        if (!response.ok) throw new Error("This file can't be uploaded here.");
        const { maximum_size_in_bytes } = (await response.json()) as { maximum_size_in_bytes: number };
        // The backend checks the file's real type once it's uploaded, and removes it if it doesn't fit.
        return { maximumSizeInBytes: maximum_size_in_bytes, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload refused." }, { status: 400 });
  }
}
