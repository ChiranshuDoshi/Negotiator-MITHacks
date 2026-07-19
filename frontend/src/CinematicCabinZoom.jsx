function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const position = clamp((value - edge0) / (edge1 - edge0));
  return position * position * (3 - 2 * position);
}

export function CinematicCabinZoom({ progress, style }) {
  const screenApproach = smoothstep(0, 0.86, progress);

  return (
    <div className="cinematic-cabin-zoom" style={style} aria-hidden="true">
      <img
        className="cabin-zoom-image cabin-zoom-image--wide"
        src="/assets/between-front-seats.webp"
        alt=""
        style={{
          transform: `scale(${1 + screenApproach * 0.68})`,
        }}
      />
    </div>
  );
}
