"use client";

import { useEffect, useRef, useState } from "react";
import { getLabelPrintAction } from "@/app/actions/labelActions";
import type { LabelPrint } from "@/services/labelPrintRepository";

/**
 * Camera + QR-decode + label-lookup mechanics shared by every "scan a
 * drum's QR code" entry point in the app (ManifestFieldsForm.tsx's own
 * picker, and the compact scan-only delegate page) -- previously
 * duplicated inline in ManifestFieldsForm.tsx alone; pulled out here
 * before a second UI needed the exact same ~90 lines.
 *
 * Deliberately does the facility-mismatch check INSIDE the hook (given
 * `facilityEpaSiteId`), since every caller needs the identical check —
 * only what happens on a SUCCESSFUL resolve (aggregating into whatever
 * shape of waste-line state the caller keeps) differs per caller, via
 * `onLabelResolved`.
 */
export function useQrLabelScanner(facilityEpaSiteId: string, onLabelResolved: (label: LabelPrint) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const stopScan = () => {
    if (scanRafRef.current !== null) cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  // Cleanup on unmount, in case the page is navigated away from mid-scan.
  useEffect(() => stopScan, []);

  const handleScannedLabelUrl = async (rawValue: string) => {
    const match = rawValue.match(/\/labels\/([^/?#]+)/);
    if (!match) {
      setScanError("That QR code doesn't look like a ManifestMate drum label.");
      return;
    }
    stopScan();
    setScanLoading(true);
    const label = await getLabelPrintAction(match[1]);
    setScanLoading(false);

    if (!label) {
      setScanError("This label wasn't found — it may have been removed.");
      return;
    }

    const facilityId = facilityEpaSiteId.trim().toUpperCase();
    const labelEpaId = label.disposalFacilityEpaId.trim().toUpperCase();
    if (!facilityId) {
      setScanError("This manifest's designated facility isn't known here yet — try again in a moment.");
      return;
    }
    if (facilityId !== labelEpaId) {
      setScanError(
        `This label is approved for ${label.disposalFacilityName || "an unnamed facility"} (${label.disposalFacilityEpaId}), not the designated facility on this manifest (${facilityEpaSiteId}).`
      );
      return;
    }

    setScanError(null);
    onLabelResolved(label);
  };

  const startScan = async () => {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      // Wait a tick for the video element to mount (setScanning above
      // triggers the conditional render below).
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      const jsQR = (await import("jsqr")).default;
      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              handleScannedLabelUrl(code.data);
              return;
            }
          }
        }
        scanRafRef.current = requestAnimationFrame(tick);
      };
      scanRafRef.current = requestAnimationFrame(tick);
    } catch {
      setScanError("Couldn't access the camera — check your browser's camera permission for this site.");
      setScanning(false);
    }
  };

  return { scanning, scanError, scanLoading, videoRef, canvasRef, startScan, stopScan, setScanError };
}

export type { LabelPrint };
