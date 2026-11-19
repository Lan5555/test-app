type Channel = "music" | "effects";

interface Layer {
  channel: Channel;
  request: AbortController;
  level: number;
  source?: AudioBufferSourceNode;
  envelope?: GainNode;
  retire?: ReturnType<typeof setTimeout>;
}

const SCENE_FADE = 1.4;
const EXIT_FADE = 0.65;

export function prepareAdventureLoop(buffer: AudioBuffer, music: boolean) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const { length, sampleRate } = buffer;
  let start = 0;
  let end = length;

  if (music) {
    const window = Math.max(1, Math.round(sampleRate * 0.05));
    const trimLimit = Math.min(sampleRate * 16, Math.floor(length / 4));
    const quiet = (offset: number) => channels.every((samples) => {
      let energy = 0;
      for (let index = offset; index < offset + window; index++) energy += samples[index] ** 2;
      return energy < window * 0.012 ** 2;
    });
    while (start + window <= trimLimit && quiet(start)) start += window;
    while (length - end + window <= trimLimit && quiet(end - window)) end -= window;
  }

  const overlap = Math.min(Math.round(sampleRate * (music ? 7 : 1.6)), Math.floor((end - start) / 4));
  if (overlap < 2) return { offset: 0, loopStart: 0, loopEnd: buffer.duration };

  // Merge the opening into the tail. The last mixed sample then leads
  // directly into the following sample at loopStart.
  for (let index = 0; index < overlap; index++) {
    const angle = (index / (overlap - 1)) * Math.PI / 2;
    const outgoing = Math.cos(angle);
    const incoming = Math.sin(angle);
    const tail = end - overlap + index;
    for (const samples of channels) {
      samples[tail] = samples[tail] * outgoing + samples[start + index] * incoming;
    }
  }
  return { offset: start / sampleRate, loopStart: (start + overlap) / sampleRate, loopEnd: end / sampleRate };
}

export class AdventureSoundscape {
  private layers = new Map<string, Layer>();
  private context?: AudioContext;
  private buses?: Record<Channel, GainNode>;

  constructor(private gain: (channel: Channel) => number) {}

  play(music: string, ambience: string, indoors: boolean) {
    if (!this.context) {
      const context = new AudioContext();
      const createBus = () => {
        const bus = context.createGain();
        bus.connect(context.destination);
        return bus;
      };
      this.context = context;
      this.buses = { music: createBus(), effects: createBus() };
    }
    document.addEventListener("visibilitychange", this.updateVolumes);
    this.updateVolumes();
    if (this.context.state !== "running") {
      window.addEventListener("pointerdown", this.resume);
      window.addEventListener("keydown", this.resume);
      this.resume();
    }
    this.select(music, "music", indoors ? 0.32 : 0.56);
    this.select(ambience, "effects", indoors ? 0.62 : 0.78);
  }

  updateVolumes = () => {
    if (!this.buses) return;
    this.buses.music.gain.value = document.hidden ? 0 : this.gain("music");
    this.buses.effects.gain.value = document.hidden ? 0 : this.gain("effects");
  };

  stop() {
    for (const [src, layer] of this.layers) this.retire(src, layer, EXIT_FADE);
  }

  private resume = () => {
    void this.context?.resume().then(() => {
      if (this.context?.state === "running") this.removeUnlockListeners();
    }, () => {});
  };

  private removeUnlockListeners() {
    window.removeEventListener("pointerdown", this.resume);
    window.removeEventListener("keydown", this.resume);
  }

  private select(src: string, channel: Channel, level: number) {
    let layer = this.layers.get(src);
    if (layer) {
      layer.level = level;
      if (layer.source) this.activate(src, layer);
    } else {
      layer = { channel, level, request: new AbortController() };
      this.layers.set(src, layer);
      void this.load(src, layer);
    }
    for (const [other, previous] of this.layers) {
      if (other !== src && previous.channel === channel && !previous.source) this.release(other, previous);
    }
  }

  private async load(src: string, layer: Layer) {
    const context = this.context!;
    try {
      const response = await fetch(src, { signal: layer.request.signal });
      if (!response.ok) throw new Error(`Audio request returned ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (layer.request.signal.aborted) return;
      const loop = prepareAdventureLoop(buffer, layer.channel === "music");
      const source = context.createBufferSource();
      const envelope = context.createGain();
      envelope.gain.value = 0;
      envelope.connect(this.buses![layer.channel]);
      source.connect(envelope);
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = loop.loopStart;
      source.loopEnd = loop.loopEnd;
      layer.source = source;
      layer.envelope = envelope;
      source.start(0, loop.offset);
      this.activate(src, layer);
    } catch {
      if (!layer.request.signal.aborted) this.release(src, layer);
    }
  }

  private activate(src: string, layer: Layer) {
    clearTimeout(layer.retire);
    layer.retire = undefined;
    this.fade(layer, layer.level, SCENE_FADE);
    for (const [other, previous] of this.layers) {
      if (other !== src && previous.channel === layer.channel) this.retire(other, previous, SCENE_FADE);
    }
  }

  private fade(layer: Layer, level: number, duration: number) {
    const gain = layer.envelope!.gain;
    gain.setTargetAtTime(level, this.context!.currentTime, duration / 7);
  }

  private retire(src: string, layer: Layer, duration: number) {
    if (!layer.source || this.context?.state !== "running") {
      this.release(src, layer);
    } else if (layer.retire === undefined) {
      this.fade(layer, 0, duration);
      layer.retire = setTimeout(() => this.release(src, layer), duration * 1000);
    }
  }

  private release(src: string, layer: Layer) {
    clearTimeout(layer.retire);
    layer.request.abort();
    layer.source?.stop();
    layer.source?.disconnect();
    layer.envelope?.disconnect();
    this.layers.delete(src);
    if (this.layers.size) return;
    document.removeEventListener("visibilitychange", this.updateVolumes);
    this.removeUnlockListeners();
    if (this.context?.state === "running") void this.context.suspend().catch(() => {});
  }
}
