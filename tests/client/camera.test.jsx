// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
