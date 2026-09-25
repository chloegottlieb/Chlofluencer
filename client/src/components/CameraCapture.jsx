import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HOLD_TO_RECORD_MS,
  MAX_VIDEO_MS,
  baseMimeType,
  cameraErrorMessage,
  cameraSupported,
  cropTo916,
  extensionFor,
  formatRecordingTime,
  pickRecorderMimeType,
} from '../lib/camera.js';

/**
 * Full-screen in-app camera, Instagram style:
 *  - tap the shutter for a photo, press and hold (or switch to Video) to record
 *  - flip between front and back cameras
 *  - review the shot, then "Use" or "Retake"
 * Calls onCapture(file, { durationMs }) with a ready-to-upload File.
 */
export default function CameraCapture({ onCapture, onClose, onUseLibrary }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const holdTimerRef = useRef(null);
  const heldRef = useRef(false);

  const [facing, setFacing] = useState('environment');
  const [mode, setMode] = useState('photo');
  const [status, setStatus] = useState('starting'); // starting | ready | recording | review | error
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [shot, setShot] = useState(null); // { file, url, kind, durationMs }

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setStatus('starting');
    if (!cameraSupported()) {
      setError(cameraErrorMessage({ name: 'Unsupported' }));
      setStatus('error');
      return;
    }
    const video = { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } };
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch (err) {
        // No microphone (or mic denied) — photos and silent video still work.
        if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } else throw err;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.()?.catch?.(() => {});
      }
      setError('');
      setStatus('ready');
    } catch (err) {
      setError(cameraErrorMessage(err));
      setStatus('error');
    }
  }, [facing, stopStream]);

  useEffect(() => {
    if (!shot) startStream();
    return stopStream;
  }, [startStream, stopStream, shot]);

  useEffect(() => () => shot?.url && URL.revokeObjectURL(shot.url), [shot]);

  // --- Photo ------------------------------------------------------------------
  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const { sx, sy, sw, sh } = cropTo916(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = sw || 1080;
    canvas.height = sh || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Taking photos is not supported in this browser.');
      return;
    }
    if (facing === 'user') {
      // Match the mirrored selfie preview.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("Couldn't capture the photo. Try again.");
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopStream();
        setShot({ file, url: URL.createObjectURL(file), kind: 'image' });
        setStatus('review');
      },
      'image/jpeg',
      0.9,
    );
  }, [facing, stopStream]);

  // --- Video ------------------------------------------------------------------
  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser.');
      return;
    }
    const mimeType = pickRecorderMimeType();
    let rec;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError('Video recording is not supported in this browser.');
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const durationMs = Math.min(MAX_VIDEO_MS, Date.now() - recordStartRef.current);
      const type = baseMimeType(rec.mimeType || mimeType);
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `video-${Date.now()}.${extensionFor(type)}`, { type });
      stopStream();
      setShot({ file, url: URL.createObjectURL(file), kind: 'video', durationMs });
      setStatus('review');
    };
    recorderRef.current = rec;
    recordStartRef.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setStatus('recording');
  }, [stopStream]);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    const id = window.setInterval(() => {
      const ms = Date.now() - recordStartRef.current;
      setElapsed(ms);
      if (ms >= MAX_VIDEO_MS) stopRecording();
    }, 200);
    return () => window.clearInterval(id);
  }, [status, stopRecording]);

  // Shutter: tap = photo (or start/stop in video mode); hold = record.
  const onShutterDown = () => {
    if (mode !== 'photo' || status !== 'ready') return;
    heldRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      startRecording();
    }, HOLD_TO_RECORD_MS);
  };
  const onShutterUp = () => {
    window.clearTimeout(holdTimerRef.current);
    if (heldRef.current) stopRecording();
  };
  const onShutterClick = () => {
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    if (mode === 'video') {
      if (status === 'recording') stopRecording();
      else if (status === 'ready') startRecording();
    } else if (status === 'ready') {
      takePhoto();
    }
  };

  const retake = () => {
    setStatus('starting');
    setShot(null);
    setElapsed(0);
  };

  const use = () => {
    onCapture(shot.file, { durationMs: shot.durationMs ?? null, kind: shot.kind });
  };

  const recording = status === 'recording';

  return (
    <div className="camera" role="dialog" aria-label="Camera" data-testid="camera" data-status={status}>
      {status === 'review' && shot ? (
        shot.kind === 'image' ? (
          <img className="camera-feed" src={shot.url} alt="Captured photo" />
        ) : (
          <video className="camera-feed" src={shot.url} autoPlay loop playsInline controls aria-label="Captured video" />
        )
      ) : (
        <video
          ref={videoRef}
          className={`camera-feed ${facing === 'user' ? 'mirrored' : ''}`}
          autoPlay
          muted
          playsInline
          data-testid="camera-feed"
        />
      )}

      <div className="camera-top">
        <button type="button" className="icon-btn" aria-label="Close camera" onClick={onClose}>✕</button>
        {recording && (
          <span className="rec-timer" role="timer" aria-label="Recording time">
            ● {formatRecordingTime(elapsed)}
          </span>
        )}
        <span />
      </div>

      {status === 'error' && (
        <div className="camera-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn primary" onClick={onUseLibrary}>Choose from camera roll</button>
          <button type="button" className="btn ghost" onClick={startStream}>Try again</button>
        </div>
      )}

      {status === 'review' && shot ? (
        <div className="camera-bottom review">
          <button type="button" className="btn ghost" onClick={retake}>Retake</button>
          <button type="button" className="btn primary" onClick={use}>
            Use {shot.kind === 'image' ? 'photo' : 'video'}
          </button>
        </div>
      ) : (
        status !== 'error' && (
          <div className="camera-bottom">
            {error && <p className="camera-hint">{error}</p>}
            <div className="camera-modes" role="radiogroup" aria-label="Camera mode">
              {['photo', 'video'].map((m) => (
                <button
                  type="button"
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  disabled={recording}
                  className={mode === m ? 'active' : ''}
                  onClick={() => setMode(m)}
                >
                  {m === 'photo' ? 'Photo' : 'Video'}
                </button>
              ))}
            </div>
            <div className="camera-controls">
              <button type="button" className="icon-btn camera-side" aria-label="Camera roll" onClick={onUseLibrary} disabled={recording}>
                🖼
              </button>
              <button
                type="button"
                className={`shutter ${mode} ${recording ? 'recording' : ''}`}
                aria-label={recording ? 'Stop recording' : mode === 'photo' ? 'Take photo' : 'Start recording'}
                disabled={status === 'starting'}
                onPointerDown={onShutterDown}
                onPointerUp={onShutterUp}
                onPointerLeave={onShutterUp}
                onClick={onShutterClick}
                style={recording ? { '--progress': `${(elapsed / MAX_VIDEO_MS) * 360}deg` } : undefined}
              />
              <button
                type="button"
                className="icon-btn camera-side"
                aria-label="Flip camera"
                disabled={recording}
                onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              >
                ⟲
              </button>
            </div>
            <p className="camera-hint">
              {mode === 'photo' ? 'Tap for photo · hold for video' : 'Tap to start / stop · up to 60s'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
