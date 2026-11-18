import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, Camera, AlertTriangle } from 'lucide-react';

interface QrScannerModalProps {
    onScan: (payload: string) => void;
    onClose: () => void;
}

/**
 * Full-screen camera QR scanner for the "Scan the Farmer QR code" search
 * method. Uses jsQR (pure JS, no native deps) against a canvas snapshot of
 * the live camera feed, sampled on a requestAnimationFrame loop.
 */
const QrScannerModal: React.FC<QrScannerModalProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);

    const tick = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) {
                    setScanning(false);
                    onScan(code.data);
                    return; // stop the loop, parent will unmount us
                }
            }
        }
        rafRef.current = requestAnimationFrame(tick);
    }, [onScan]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                rafRef.current = requestAnimationFrame(tick);
            } catch (e: any) {
                setError(e?.message || 'Could not access camera. Check camera permissions.');
            }
        })();

        return () => {
            mounted = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl overflow-hidden max-w-md w-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Camera className="h-4 w-4" /> Scan Farmer QR Code
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="relative bg-black aspect-square">
                    {error ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center gap-2">
                            <AlertTriangle className="h-8 w-8 text-yellow-400" />
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : (
                        <>
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-56 h-56 border-2 border-green-400 rounded-lg" />
                            </div>
                        </>
                    )}
                </div>
                <div className="px-4 py-3 text-xs text-gray-500 text-center">
                    {scanning ? 'Point the camera at the farmer\u2019s QR identity card.' : 'Code detected...'}
                </div>
            </div>
        </div>
    );
};

export default QrScannerModal;
