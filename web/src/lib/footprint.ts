// Inverse local WGS84 azimuthal-equidistant coordinates via Vincenty's direct
// geodesic. Edges are sampled every 5 km; these are analysis windows, not parcels.
export function aeqdPoint(lon: number, lat: number, x: number, y: number): [number, number] {
  const a = 6378137, f = 1 / 298.257223563, b = a * (1 - f);
  const rad = Math.PI / 180;
  const alpha = Math.atan2(x, y), distance = Math.hypot(x, y);
  const u = Math.atan((1 - f) * Math.tan(lat * rad));
  const sinU = Math.sin(u), cosU = Math.cos(u);
  const sinAlpha = cosU * Math.sin(alpha), cosSqAlpha = 1 - sinAlpha ** 2;
  const sigma1 = Math.atan2(Math.tan(u), Math.cos(alpha));
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  let sigma = distance / (b * A);
  for (let i = 0; i < 20; i++) {
    const c = Math.cos(2 * sigma1 + sigma), s = Math.sin(sigma), cs = Math.cos(sigma);
    const delta = B * s * (c + B / 4 * (cs * (-1 + 2 * c * c) - B / 6 * c * (-3 + 4 * s * s) * (-3 + 4 * c * c)));
    const next = distance / (b * A) + delta;
    if (Math.abs(next - sigma) < 1e-13) { sigma = next; break; }
    sigma = next;
  }
  const s = Math.sin(sigma), c = Math.cos(sigma);
  const tmp = sinU * s - cosU * c * Math.cos(alpha);
  const phi = Math.atan2(sinU * c + cosU * s * Math.cos(alpha), (1 - f) * Math.hypot(sinAlpha, tmp));
  const lambda = Math.atan2(s * Math.sin(alpha), cosU * c - sinU * s * Math.cos(alpha));
  const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
  const c2 = Math.cos(2 * sigma1 + sigma);
  const L = lambda - (1 - C) * f * sinAlpha * (sigma + C * s * (c2 + C * c * (-1 + 2 * c2 * c2)));
  // Keep the ring continuous when it crosses ±180°. MapLibre wraps the world.
  return [lon + L / rad, phi / rad];
}
export function analysisRing(lon: number, lat: number, widthKm: number): [number, number][] {
  if (![lon, lat, widthKm].every(Number.isFinite) || widthKm <= 0 || widthKm > 100 || Math.abs(lat) > 85) return [];
  const half = widthKm * 500, steps = Math.ceil(widthKm / 5);
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const ring: [number, number][] = [];
  corners.forEach(([x, y], edge) => {
    const [nx, ny] = corners[(edge + 1) % 4];
    for (let i = 0; i < steps; i++) ring.push(aeqdPoint(lon, lat, x + (nx - x) * i / steps, y + (ny - y) * i / steps));
  });
  ring.push(ring[0]);
  return ring;
}
