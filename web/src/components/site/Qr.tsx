"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR code for a path on this same site (whatever host it is served from). Dark modules on white for reliable scanning. */
export function QrCode({ path, label, lang }: { path: string; label: string; lang: string }) {
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}${path}`;
    let live = true;
    QRCode.toString(u, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#030405", light: "#ffffff" } })
      .then(s => { if (live) { setSvg(s); setUrl(u); } })
      .catch(() => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path, lang]);
  return <figure>
    <div role="img" aria-label={label} className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    {url && <figcaption className="mt-2 break-all text-center text-[11px] leading-4 text-[#333]">{url.replace(/^https?:\/\//, "")}</figcaption>}
  </figure>;
}
