#!/usr/bin/env python3
"""
AlloAppart — bande-son synthétisée de la publicité (20 s, 48 kHz, stéréo).

100 % procédurale (numpy + scipy) : aucun sample, aucun droit tiers.
Calée frame par frame sur src/config/timeline.ts (30 fps) :

  0 → 4 s     tension : drone froid, pulsation discrète, blips de glitch,
              impacts sourds sur "Annonces douteuses / Visites annulées /
              Arnaques au loyer"
  3.2 → 4 s   riser (souffle + sinus montant)
  4.03 s      IMPACT de révélation : sub + accord lumineux (Ré maj9)
  4 → 20 s    musique chaleureuse et confiante, 120 BPM (1 temps = 15 frames) :
              nappe, arpèges pluck en ping-pong, sub-basse, kick doux et
              hi-hats à partir de l'acte 3, ponctuations (badge, cartes, CTA)
  18.7 → 20 s retour progressif du drone → raccord de boucle frame 600 → 0

Usage :  python scripts/generate-soundtrack.py
Sortie : public/audio/soundtrack.wav

Pour une diffusion commerciale, cette piste peut être remplacée par une
musique sous licence : garder les mêmes points de synchro (AUDIO_CUES).
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48_000
FPS = 30
DUR = 20.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def f2s(frame: float) -> int:
    return int(round(frame / FPS * SR))


def note(name: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    midi = 12 * (octave + 1) + names[pitch]
    return 440.0 * 2 ** ((midi - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env_adsr(n, a, d, s, r, sustain_len):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, int(sustain_len * SR) - a_n - d_n)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1), endpoint=False),
        np.linspace(1, s, max(d_n, 1), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def place(buf, sig, start, gain=1.0, pan=0.0):
    """Ajoute un signal mono dans le buffer stéréo (pan -1..1, loi à puissance constante)."""
    if start >= N:
        return
    end = min(N, start + len(sig))
    seg = sig[: end - start] * gain
    lg = np.cos((pan + 1) * np.pi / 4)
    rg = np.sin((pan + 1) * np.pi / 4)
    buf[start:end, 0] += seg * lg
    buf[start:end, 1] += seg * rg


def smooth_ramp(x0, x1, y0, y1):
    """Courbe 0..1 lissée (cosinus) sur l'axe temps global."""
    k = np.clip((t - x0) / max(x1 - x0, 1e-9), 0, 1)
    k = 0.5 - 0.5 * np.cos(np.pi * k)
    return y0 + (y1 - y0) * k


# ─────────────────────────── instruments ───────────────────────────

def saw(freq, n, detune=0.0):
    ph = np.cumsum(np.full(n, freq * (1 + detune)) / SR)
    return 2 * (ph % 1.0) - 1


def soft_pad(freqs, dur, voices=3):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 0.004
            out += saw(f, n, det) * 0.33
    out = lp(out, 1800, 2)
    return out / max(len(freqs), 1)


def pluck(freq, dur=0.6, bright=4000):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(2 * np.pi * 2 * freq * tt) + 0.12 * np.sin(2 * np.pi * 3 * freq * tt))
    x *= np.exp(-tt * 7.5) * np.minimum(1, tt / 0.003)
    return lp(x, bright, 1)


def bell(freq, dur=2.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    partials = [(1, 1.0, 2.2), (2.0, 0.45, 3.5), (2.76, 0.3, 4.5), (5.4, 0.12, 7.0)]
    x = sum(a * np.sin(2 * np.pi * freq * m * tt) * np.exp(-tt * d) for m, a, d in partials)
    return x * np.minimum(1, tt / 0.002)


def kick(dur=0.45, f0=110, f1=42, gain=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-tt * 7)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-tt * 300) * 0.15
    return (x + click) * gain


def hat(dur=0.08):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000, 2) * np.exp(-tt * 60)


def noise_swell(dur, lo=300, hi=6000, curve=2.0):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    k = np.linspace(0, 1, n) ** curve
    # balayage de filtre par blocs
    out = np.zeros(n)
    blocks = 24
    for i in range(blocks):
        a, b = i * n // blocks, (i + 1) * n // blocks
        fc = lo + (hi - lo) * (i / (blocks - 1)) ** 1.5
        out[a:b] = bp(x, max(60, fc * 0.5), min(SR / 2 - 100, fc * 1.4))[a:b]
    return out * k


def whoosh(dur=0.7):
    n = int(dur * SR)
    tt = np.linspace(0, 1, n)
    e = np.sin(np.pi * tt) ** 2
    return bp(rng.standard_normal(n), 400, 5000) * e


def blip(freq=1800, dur=0.05):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * freq * tt)) * np.exp(-tt * 70)
    return lp(x, 5000) * 0.5


# ─────────────────────────── mix ───────────────────────────

dry = np.zeros((N, 2))
wet_send = np.zeros((N, 2))  # envoi réverbe

# ── ACTE 1 : tension (0 → 4 s) + retour en fin de boucle (18.7 → 20 s)
drone_f = [note("A1"), note("E2"), note("A#2")]  # quinte + seconde mineure = malaise discret
drone = np.zeros(N)
for f in drone_f:
    drone += saw(f, N, 0.002) * 0.5 + saw(f, N, -0.003) * 0.5
drone = lp(drone, 380, 2)
# tremolo lent
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.9 * t)
drone_env = np.where(t < 4.2, smooth_ramp(3.6, 4.1, 1.0, 0.0), 0.0) + smooth_ramp(18.5, 20.0, 0.0, 1.0)
place(dry, drone * drone_env, 0, 0.11)

# pulsation : battement grave régulier (cœur / horloge), 100 BPM
for i, beat in enumerate(np.arange(0.0, 3.7, 0.6)):
    place(dry, kick(0.3, 70, 38, 0.6), int(beat * SR), 0.26 + 0.04 * (i % 2))
for beat in np.arange(0.3, 3.7, 0.6):
    place(dry, hat(0.04), int(beat * SR), 0.05, 0.4)

# blips de glitch (frames identiques à l'animation)
for fr, freq, pan in [(27, 2100, -0.5), (53, 1500, 0.5), (62, 900, 0.6), (81, 2600, -0.3), (95, 1200, 0.2)]:
    place(dry, blip(freq, 0.06), f2s(fr), 0.12, pan)
    place(dry, lp(rng.standard_normal(int(0.05 * SR)), 3000) * np.exp(-np.arange(int(0.05 * SR)) / SR * 60), f2s(fr), 0.05, -pan)

# impacts "problème"
for fr, root in [(40, "D3"), (52, "C#3"), (64, "C3")]:
    hit = kick(0.6, 90, 40, 0.9)
    tone = pluck(note(root), 1.2, 1500) * 0.6 + pluck(note(root) * 1.414, 1.2, 1500) * 0.3  # triton
    place(dry, hit, f2s(fr), 0.5)
    place(dry, tone, f2s(fr), 0.18)
    place(wet_send, tone, f2s(fr), 0.12)

# ── RISER 3.2 → 4.03 s
rs, re_ = f2s(96), f2s(121)
riser = noise_swell((re_ - rs) / SR, 300, 9000, 2.2)
place(dry, riser, rs, 0.22)
place(wet_send, riser, rs, 0.15)
n_r = re_ - rs
tt = np.arange(n_r) / SR
sweep_f = 220 * 2 ** (np.linspace(0, 1, n_r) ** 1.6 * 2)
place(dry, np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * np.linspace(0, 1, n_r) ** 2, rs, 0.06)

# ── IMPACT DE RÉVÉLATION (frame 121)
imp = f2s(121)
place(dry, kick(1.6, 120, 32, 1.2), imp, 0.75)
chord = ["D4", "F#4", "A4", "E5", "A5"]
for i, nm in enumerate(chord):
    b = bell(note(nm), 3.5)
    pan = (i / (len(chord) - 1)) * 1.2 - 0.6
    place(dry, b, imp + i * int(0.012 * SR), 0.07, pan)
    place(wet_send, b, imp + i * int(0.012 * SR), 0.09, pan)
# souffle inversé qui se résout dans l'impact
place(wet_send, whoosh(1.2), imp - int(0.2 * SR), 0.05)

# ── MUSIQUE 4 → 20 s, 120 BPM (temps = 0.5 s = 15 frames)
BEAT = 0.5
start = 4.0
progression = [  # (accord de nappe, basse, notes d'arpège) — 2 s par accord
    (["D3", "F#3", "A3", "C#4", "E4"], "D2", ["D4", "A4", "C#5", "E5"]),
    (["B2", "D3", "F#3", "A3", "E4"], "B1", ["B3", "F#4", "A4", "D5"]),
    (["G2", "B2", "D3", "F#3", "A3"], "G1", ["G4", "D5", "F#5", "A4"]),
    (["A2", "D3", "E3", "G3", "B3"], "A1", ["A4", "E5", "B4", "D5"]),
    (["D3", "F#3", "A3", "C#4", "E4"], "D2", ["D4", "A4", "C#5", "E5"]),
    (["B2", "D3", "F#3", "A3", "E4"], "B1", ["B3", "F#4", "A4", "D5"]),
    (["G2", "B2", "D3", "F#3", "A3"], "G1", ["G4", "D5", "F#5", "A4"]),
    (["A2", "C#3", "E3", "G3", "B3"], "A1", ["A4", "E5", "C#5", "E5"]),
]
music_end = 19.0
for ci, (pad_notes, bass, arp) in enumerate(progression):
    c0 = start + ci * 2.0
    if c0 >= music_end:
        break
    seg = min(2.0, music_end - c0)
    # nappe
    pad = soft_pad([note(x) for x in pad_notes], seg + 1.2)
    pad *= env_adsr(len(pad), 0.35 if ci else 0.9, 0.3, 0.85, 1.0, seg + 0.2)
    place(dry, pad, int(c0 * SR), 0.13, -0.15)
    place(dry, pad, int(c0 * SR), 0.13, 0.15)
    place(wet_send, pad, int(c0 * SR), 0.08)
    # sub-basse
    bn = int((seg + 0.3) * SR)
    btt = np.arange(bn) / SR
    sub = np.sin(2 * np.pi * note(bass) * btt) * env_adsr(bn, 0.02, 0.2, 0.8, 0.3, seg)
    place(dry, sub, int(c0 * SR), 0.20 if c0 >= 9.0 else 0.11)
    # arpèges : croches à partir de 5 s, doubles-croches dans l'acte 3
    step = BEAT / 2 if c0 >= 9.0 else BEAT
    k = 0
    for s in np.arange(0, seg - 1e-6, step):
        if c0 + s < 5.0:
            continue
        nm = arp[k % len(arp)]
        k += 1
        p = pluck(note(nm), 0.7, 5000)
        pan = -0.45 if k % 2 else 0.45
        g = 0.085 if step == BEAT else 0.065
        place(dry, p, int((c0 + s) * SR), g, pan)
        place(wet_send, p, int((c0 + s) * SR), 0.05, pan)

# percussions à partir de l'acte 3 (9 s), kick plus présent dans l'acte 4
for b in np.arange(9.0, music_end - 0.25, BEAT):
    strong = (round((b - 9.0) / BEAT) % 2) == 0
    place(dry, kick(0.4, 100, 45, 1.0), int(b * SR), 0.42 if strong else 0.30)
    place(dry, hat(0.06), int((b + BEAT / 2) * SR), 0.07, 0.3)
# légère pré-pulsation dans l'acte 2 (≈ battement de cœur apaisé)
for b in np.arange(6.0, 9.0, 1.0):
    place(dry, kick(0.35, 80, 42, 0.8), int(b * SR), 0.22)

# ── ponctuations synchronisées sur l'image
# reflet du logo (150) + verrouillage du lockup (180)
place(wet_send, bell(note("A5"), 2.0), f2s(150), 0.05, 0.3)
place(dry, bell(note("D6"), 1.6), f2s(180), 0.035, -0.2)
# badge AlloVérifié™ (check à ~frame 216)
for i, nm in enumerate(["A5", "D6", "F#6"]):
    place(dry, bell(note(nm), 1.8), f2s(214) + i * int(0.07 * SR), 0.05, -0.3 + i * 0.3)
    place(wet_send, bell(note(nm), 1.8), f2s(214) + i * int(0.07 * SR), 0.05)
# transitions d'actes
place(dry, whoosh(0.8), f2s(262), 0.10, -0.2)
place(dry, whoosh(0.9), f2s(436), 0.10, 0.2)
# entrées des cartes : petits "ticks" UI
for i, fr in enumerate([284, 294, 304, 314]):
    place(dry, pluck(note(["A5", "B5", "C#6", "E6"][i]), 0.25, 8000), f2s(fr), 0.05, -0.5 + i * 0.33)
# slogan + CTA
place(wet_send, whoosh(1.0), f2s(462), 0.06)
place(dry, kick(1.0, 110, 36, 1.1), f2s(496), 0.5)
for i, nm in enumerate(["D5", "A5", "F#6"]):
    place(dry, bell(note(nm), 2.8), f2s(496) + i * int(0.03 * SR), 0.06, -0.4 + i * 0.4)
    place(wet_send, bell(note(nm), 2.8), f2s(496) + i * int(0.03 * SR), 0.07)

# ── réverbe (IR synthétique stéréo, ~2.2 s)
ir_n = int(2.2 * SR)
irt = np.arange(ir_n) / SR
ir_l = rng.standard_normal(ir_n) * np.exp(-irt * 3.0)
ir_r = rng.standard_normal(ir_n) * np.exp(-irt * 3.0)
ir_l, ir_r = lp(ir_l, 6000), lp(ir_r, 6000)
ir_l /= np.sqrt(np.sum(ir_l ** 2))
ir_r /= np.sqrt(np.sum(ir_r ** 2))
wet = np.stack([fftconvolve(wet_send[:, 0], ir_l)[:N], fftconvolve(wet_send[:, 1], ir_r)[:N]], axis=1)

mix = dry + wet * 0.9
mix = hp(mix.T, 28).T  # nettoie l'infra-grave

# ── fondu global de la musique en fin de boucle (laisser le drone seul)
music_fade = smooth_ramp(18.6, 19.9, 1.0, 0.0)
drone_tail = np.zeros((N, 2))
place(drone_tail, drone * smooth_ramp(18.5, 20.0, 0.0, 1.0), 0, 0.11)
mix = (mix - drone_tail) * music_fade[:, None] + drone_tail

# ── master : compression douce + limiteur
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
peak = np.max(np.abs(mix))
mix = mix / peak * 10 ** (-1.0 / 20)  # -1 dBFS

# micro fondus aux bords (évite tout clic au raccord de boucle)
edge = int(0.004 * SR)
mix[:edge] *= np.linspace(0, 1, edge)[:, None]
mix[-edge:] *= np.linspace(1, 0, edge)[:, None]

out = Path(__file__).resolve().parent.parent / "public" / "audio" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print(f"OK → {out}  ({DUR:.1f} s, {SR} Hz, stéréo)")
