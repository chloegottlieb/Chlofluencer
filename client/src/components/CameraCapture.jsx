import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HANDS_FREE_DELAYS,
  HANDS_FREE_LENGTHS,
  HOLD_TO_RECORD_MS,
  MAX_VIDEO_MS,
  baseMimeType,
  cameraErrorMessage,
  cameraSupported,
  cropTo916,
  extensionFor,
  formatRecordingTime,
  loadHandsFreePrefs,
  pickRecorderMimeType,
  saveHandsFreePrefs,
} from '../lib/camera.js';

const MODES = [
  ['photo', 'Photo'],
  ['video', 'Video'],
  ['handsfree', 'Hands-free'],
];

/**
 * Full-screen in-app camera, Instagram style:
 *  - tap the shutter for a photo, press and hold (or switch to Video) to record
 *  - Hands-free: tap once, a countdown lets you step back, then recording
 *    starts and stops on its own after the chosen length
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
  const limitRef = useRef(MAX_VIDEO_MS);

  const [facing, setFacing] = useState('environment');
  const [mode, setMode] = useState('photo');
  const [status, setStatus] = useState('starting'); // starting | ready | countdown | recording | review | error
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [shot, setShot] = useState(null); // { file, url, kind, durationMs }
  const [handsFree, setHandsFree] = useState(loadHandsFreePrefs);
  const [countdown, setCountdown] = useState(0);

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

  const startRecording = useCallback((limitMs = MAX_VIDEO_MS) => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser.');
      setStatus((st) => (st === 'countdown' ? 'ready' : st));
      return;
    }
    const mimeType = pickRecorderMimeType();
    let rec;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError('Video recording is not supported in this browser.');
      setStatus((st) => (st === 'countdown' ? 'ready' : st));
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const durationMs = Math.min(limitRef.current, Date.now() - recordStartRef.current);
      const type = baseMimeType(rec.mimeType || mimeType);
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `video-${Date.now()}.${extensionFor(type)}`, { type });
      stopStream();
      setShot({ file, url: URL.createObjectURL(file), kind: 'video', durationMs });
      setStatus('review');
    };
    recorderRef.current = rec;
    limitRef.current = Math.min(limitMs, MAX_VIDEO_MS);
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
      if (ms >= limitRef.current) stopRecording();
    }, 200);
    return () => window.clearInterval(id);
  }, [status, stopRecording]);

  // --- Hands-free ---------------------------------------------------------------
  const updateHandsFree = (patch) => {
    const next = { ...handsFree, ...patch };
    setHandsFree(next);
    saveHandsFreePrefs(next);
  };

  const startHandsFree = useCallback(() => {
    if (handsFree.delaySec === 0) {
      startRecording(handsFree.lengthSec * 1000);
    } else {
      setCountdown(handsFree.delaySec);
      setStatus('countdown');
    }
  }, [handsFree, startRecording]);

  const cancelCountdown = () => {
    setCountdown(0);
    setStatus('ready');
  };

  // Tick the countdown once a second, then start recording at zero.
  useEffect(() => {
    if (status !== 'countdown') return undefined;
    if (countdown <= 0) {
      startRecording(handsFree.lengthSec * 1000);
      return undefined;
    }
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [status, countdown, handsFree.lengthSec, startRecording]);

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
    if (mode === 'handsfree') {
      if (status === 'ready') startHandsFree();
      else if (status === 'countdown') cancelCountdown();
      else if (status === 'recording') stopRecording();
    } else if (mode === 'video') {
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
  const busy = recording || status === 'countdown';
  const shutterLabel =
    status === 'countdown'
      ? 'Cancel countdown'
      : recording
        ? 'Stop recording'
        : { photo: 'Take photo', video: 'Start recording', handsfree: 'Start hands-free recording' }[mode];

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
            {mode === 'handsfree' && ` / ${formatRecordingTime(limitRef.current)}`}
          </span>
        )}
        <span />
      </div>

      {status === 'countdown' && (
        <div className="countdown" data-testid="countdown">
          <span className="countdown-number" aria-live="assertive" key={countdown}>{countdown}</span>
          <span className="countdown-hint">Get in position… tap the shutter to cancel</span>
        </div>
      )}

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
            {mode === 'handsfree' && status === 'ready' && (
              <div className="handsfree-options">
                <div className="option-group" role="radiogroup" aria-label="Countdown">
                  <span className="option-label">Countdown</span>
                  {HANDS_FREE_DELAYS.map((d) => (
                    <button
                      type="button"
                      key={d}
                      role="radio"
                      aria-checked={handsFree.delaySec === d}
                      className={`chip ${handsFree.delaySec === d ? 'selected' : ''}`}
                      onClick={() => updateHandsFree({ delaySec: d })}
                    >
                      {d === 0 ? 'Off' : `${d}s`}
                    </button>
                  ))}
                </div>
                <div className="option-group" role="radiogroup" aria-label="Recording length">
                  <span className="option-label">Length</span>
                  {HANDS_FREE_LENGTHS.map((l) => (
                    <button
                      type="button"
                      key={l}
                      role="radio"
                      aria-checked={handsFree.lengthSec === l}
                      className={`chip ${handsFree.lengthSec === l ? 'selected' : ''}`}
                      onClick={() => updateHandsFree({ lengthSec: l })}
                    >
                      {l}s
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="camera-modes" role="radiogroup" aria-label="Camera mode">
              {MODES.map(([m, label]) => (
                <button
                  type="button"
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  disabled={busy}
                  className={mode === m ? 'active' : ''}
                  onClick={() => setMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="camera-controls">
              <button type="button" className="icon-btn camera-side" aria-label="Camera roll" onClick={onUseLibrary} disabled={busy}>
                🖼
              </button>
              <button
                type="button"
                className={`shutter ${mode} ${recording ? 'recording' : ''} ${status === 'countdown' ? 'counting' : ''}`}
                aria-label={shutterLabel}
                disabled={status === 'starting'}
                onPointerDown={onShutterDown}
                onPointerUp={onShutterUp}
                onPointerLeave={onShutterUp}
                onClick={onShutterClick}
                style={recording ? { '--progress': `${(elapsed / limitRef.current) * 360}deg` } : undefined}
              />
              <button
                type="button"
                className="icon-btn camera-side"
                aria-label="Flip camera"
                disabled={busy}
                onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              >
                ⟲
              </button>
            </div>
            <p className="camera-hint">
              {
                {
                  photo: 'Tap for photo · hold for video',
                  video: 'Tap to start / stop · up to 60s',
                  handsfree: recording
                    ? `Recording hands-free · stops by itself at ${formatRecordingTime(limitRef.current)} · tap to stop now`
                    : handsFree.delaySec === 0
                      ? `Tap once · stops by itself after ${handsFree.lengthSec}s`
                      : `Tap once · starts after ${handsFree.delaySec}s, stops by itself after ${handsFree.lengthSec}s`,
                }[mode]
              }
            </p>
          </div>
        )
      )}
    </div>
  );
}
