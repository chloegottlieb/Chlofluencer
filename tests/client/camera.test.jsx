// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraCapture from '../../client/src/components/CameraCapture.jsx';

let stopTrack;
let getUserMedia;

function fakeStream() {
  stopTrack = vi.fn();
  return { getTracks: () => [{ stop: stopTrack }] };
}

class FakeRecorder {
  static isTypeSupported = (t) => t === 'video/webm';
  static last = null;
  constructor(stream, opts) {
    this.stream = stream;
    this.mimeType = opts?.mimeType ?? 'video/webm';
    this.state = 'inactive';
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['frames'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  // Camera already allowed on this device (the primer has its own tests below).
  localStorage.setItem('storytime_camera_ok', '1');
  getUserMedia = vi.fn(async () => fakeStream());
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  // jsdom has no canvas: fake a 2D context and toBlob.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ translate() {}, scale() {}, drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['jpeg'], { type })));
});
afterEach(() => {
  delete navigator.mediaDevices;
  vi.unstubAllGlobals();
});

function renderCamera() {
  const props = { onCapture: vi.fn(), onClose: vi.fn(), onUseLibrary: vi.fn() };
  render(<CameraCapture {...props} />);
  return props;
}
const status = () => screen.getByTestId('camera').dataset.status;

describe('CameraCapture', () => {
  it('starts the back camera with audio', async () => {
    renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true, video: expect.objectContaining({ facingMode: 'environment' }) }));
  });

  it('falls back to video-only when the microphone is denied', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no mic'), { name: 'NotAllowedError' }));
    renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ audio: false }));
  });

  it('takes a photo, reviews it, and hands back a JPEG file', async () => {
    const { onCapture } = renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(status()).toBe('review');
    expect(screen.getByAltText('Captured photo')).toBeInTheDocument();
    expect(stopTrack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    const [file, meta] = onCapture.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(meta.kind).toBe('image');
  });

  it('retake restarts the camera', async () => {
    renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
    await waitFor(() => expect(status()).toBe('ready'));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('records a video in video mode with its duration', async () => {
    const { onCapture } = renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('radio', { name: 'Video' }));
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(status()).toBe('recording');
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flip camera' })).toBeDisabled();
    now.mockReturnValue(4_500);
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(status()).toBe('review');
    fireEvent.click(screen.getByRole('button', { name: 'Use video' }));
    const [file, meta] = onCapture.mock.calls[0];
    expect(file.type).toBe('video/webm');
    expect(file.name).toMatch(/\.webm$/);
    expect(meta).toEqual({ durationMs: 3500, kind: 'video' });
  });

  it('press-and-hold on the shutter records in photo mode', async () => {
    renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    vi.useFakeTimers();
    const shutter = screen.getByRole('button', { name: 'Take photo' });
    fireEvent.pointerDown(shutter);
    act(() => vi.advanceTimersByTime(400));
    expect(status()).toBe('recording');
    fireEvent.pointerUp(shutter);
    fireEvent.click(shutter);
    expect(status()).toBe('review');
    expect(screen.getByLabelText('Captured video')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('flips to the front camera (mirrored preview)', async () => {
    renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Flip camera' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: 'user' }) })));
    expect(screen.getByTestId('camera-feed')).toHaveClass('mirrored');
  });

  it('explains blocked permissions and offers the camera roll', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const { onUseLibrary } = renderCamera();
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is blocked');
    fireEvent.click(screen.getByRole('button', { name: 'Choose from camera roll' }));
    expect(onUseLibrary).toHaveBeenCalled();
  });

  it('explains when the camera API is unavailable (insecure context)', async () => {
    delete navigator.mediaDevices;
    renderCamera();
    expect(await screen.findByRole('alert')).toHaveTextContent('https://');
  });

  it('closes and releases the camera', async () => {
    const { onClose } = renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Close camera' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CameraCapture hands-free mode', () => {
  afterEach(() => vi.useRealTimers());

  // Each countdown tick is scheduled after React re-renders, so step 1s at a time.
  const tick = async (seconds) => {
    for (let i = 0; i < seconds; i++) await act(async () => vi.advanceTimersByTime(1000));
  };

  async function readyHandsFree() {
    const props = renderCamera();
    await waitFor(() => expect(status()).toBe('ready'));
    fireEvent.click(screen.getByRole('radio', { name: 'Hands-free' }));
    return props;
  }

  it('shows countdown and length options with defaults 3s / 15s', async () => {
    await readyHandsFree();
    expect(screen.getByRole('radiogroup', { name: 'Countdown' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3s' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '15s' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/starts after 3s, stops by itself after 15s/)).toBeInTheDocument();
  });

  it('counts down, records, and stops on its own after the chosen length', async () => {
    const { onCapture } = await readyHandsFree();
    fireEvent.click(screen.getByRole('radio', { name: '30s' }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByRole('button', { name: 'Start hands-free recording' }));
    expect(status()).toBe('countdown');
    expect(screen.getByTestId('countdown')).toHaveTextContent('3');
    // No recording yet while counting down.
    expect(FakeRecorder.last?.state).not.toBe('recording');
    await tick(1);
    expect(screen.getByTestId('countdown')).toHaveTextContent('2');
    await tick(2);
    expect(status()).toBe('recording');
    expect(screen.getByRole('timer')).toHaveTextContent('0:00 / 0:30');
    // Nobody touches the phone: it stops by itself at 30s.
    await act(async () => vi.advanceTimersByTime(29_000));
    expect(status()).toBe('recording');
    await act(async () => vi.advanceTimersByTime(1_400));
    expect(status()).toBe('review');
    fireEvent.click(screen.getByRole('button', { name: 'Use video' }));
    expect(onCapture.mock.calls[0][1]).toEqual({ durationMs: 30_000, kind: 'video' });
  });

  it('can be stopped early by tapping', async () => {
    await readyHandsFree();
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start hands-free recording' }));
    expect(status()).toBe('recording');
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(status()).toBe('review');
  });

  it('tapping during the countdown cancels it', async () => {
    await readyHandsFree();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start hands-free recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel countdown' }));
    expect(status()).toBe('ready');
    await tick(5);
    expect(status()).toBe('ready');
  });

  it('locks mode, flip and camera roll while counting down', async () => {
    await readyHandsFree();
    fireEvent.click(screen.getByRole('button', { name: 'Start hands-free recording' }));
    expect(screen.getByRole('button', { name: 'Flip camera' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Camera roll' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Photo' })).toBeDisabled();
  });

  it('remembers the chosen countdown and length', async () => {
    await readyHandsFree();
    fireEvent.click(screen.getByRole('radio', { name: '10s' }));
    fireEvent.click(screen.getByRole('radio', { name: '60s' }));
    expect(JSON.parse(localStorage.getItem('storytime_handsfree'))).toEqual({ delaySec: 10, lengthSec: 60 });
    cleanup();
    await readyHandsFree();
    expect(screen.getByRole('radio', { name: '10s' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '60s' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('CameraCapture permission primer', () => {
  it('explains, cheekily, before asking for the camera the first time', async () => {
    localStorage.removeItem('storytime_camera_ok');
    const { onUseLibrary } = renderCamera();
    expect(await screen.findByText('Say cheese! 🧀')).toBeInTheDocument();
    expect(screen.getByText(/not to judge your angles/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use my camera roll instead' }));
    expect(onUseLibrary).toHaveBeenCalled();
  });

  it('asks the OS only after "Let\'s go", then remembers', async () => {
    localStorage.removeItem('storytime_camera_ok');
    renderCamera();
    fireEvent.click(await screen.findByRole('button', { name: "Let's go" }));
    await waitFor(() => expect(status()).toBe('ready'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('storytime_camera_ok')).toBe('1');
  });

  it('"Maybe later" closes the camera', async () => {
    localStorage.removeItem('storytime_camera_ok');
    const { onClose } = renderCamera();
    fireEvent.click(await screen.findByRole('button', { name: 'Maybe later' }));
    expect(onClose).toHaveBeenCalled();
  });
});
